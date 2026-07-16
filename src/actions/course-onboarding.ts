"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { golfCourses } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import {
  countCourseMappingProgress,
  duplicateCourseError,
  findDuplicateCourses,
  getCourseOnboardingBundle,
  holeNumbersForCount,
  onboardingStepForCourse,
  replaceCourseHoles,
  replaceCourseTees,
  saveManualGreenPin,
  saveManualLineBreak,
  saveManualTeePin,
  type CourseDuplicateMatch,
} from "@/lib/course-onboarding";
import {
  parseCourseCountry,
  type CourseCountry,
} from "@/lib/course-location";
import {
  normalizeTeeKey,
  sortCourseTees,
  totalYardageForTee,
  type CourseTeeInput,
} from "@/lib/course-tees";
import { applyOsmOnboardingPrefill } from "@/lib/course-onboarding-osm-prefill";
import { parseCoordinate } from "@/lib/green-distance";
import { extractScorecardFromImage } from "@/lib/scorecard-ocr";
import { createLocalCourseId } from "@/lib/local-course";
import {
  activatePendingCourseAccessForUser,
  canUserEditCourse,
  canUserEditVerifiedCourse,
} from "@/lib/course-access";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import type {
  OnboardingActionResult,
  OsmPrefillActionResult,
  ScorecardOcrActionResult,
} from "@/lib/course-onboarding-action-result";

async function canEditVerifiedCourse(courseId: string): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  return canUserEditVerifiedCourse(userId, courseId);
}

function verifiedCourseEditError(
  onboardingStatus: string,
  allowVerifiedEdit: boolean
): string | null {
  if (onboardingStatus === "verified" && !allowVerifiedEdit) {
    return "Verified courses cannot be edited.";
  }
  return null;
}

async function getEditableOnboardingCourse(courseId: string) {
  const org = await requireOrganization();
  const { userId } = await auth();
  if (!userId) return null;

  await activatePendingCourseAccessForUser(userId);

  const course = await getDb().query.golfCourses.findFirst({
    where: eq(golfCourses.id, courseId),
    with: {
      courseHoles: true,
      courseTees: true,
    },
  });

  if (!course) return null;

  const allowed = await canUserEditCourse({
    userId,
    orgId: org.id,
    courseId: course.id,
    courseOrgId: course.orgId,
  });

  if (!allowed) return null;
  return course;
}

export async function checkCourseOnboardingDuplicate(input: {
  name: string;
  city?: string | null;
  state?: string | null;
  country?: CourseCountry | null;
  excludeCourseId?: string;
}): Promise<{ matches: CourseDuplicateMatch[] }> {
  await requireOrganization();
  const matches = await findDuplicateCourses(input);
  return { matches };
}

export async function createCourseOnboarding(input: {
  name: string;
  city?: string | null;
  state?: string | null;
  country?: CourseCountry | null;
  address?: string | null;
  latitude: number;
  longitude: number;
  holeCount: 9 | 18;
  externalCourseId?: string | null;
}): Promise<OnboardingActionResult & { courseId?: string }> {
  const org = await requireOrganization();
  const name = input.name.trim();

  if (name.length < 2) {
    return { success: false, error: "Course name is required." };
  }

  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    return { success: false, error: "Course location is required." };
  }

  const country = parseCourseCountry(input.country ?? "US");
  const duplicates = await findDuplicateCourses({
    name,
    city: input.city,
    state: input.state,
    country,
  });
  const exactDuplicate = duplicates.find((match) => match.matchType === "exact");
  if (exactDuplicate) {
    return { success: false, error: duplicateCourseError(duplicates) };
  }

  const externalCourseId = input.externalCourseId?.trim() || createLocalCourseId();

  const existing = await getDb().query.golfCourses.findFirst({
    where: eq(golfCourses.externalCourseId, externalCourseId),
  });

  if (existing && existing.orgId && existing.orgId !== org.id) {
    return {
      success: false,
      error: "This course is already being onboarded by another organization.",
    };
  }

  if (existing) {
    const [updated] = await getDb()
      .update(golfCourses)
      .set({
        orgId: org.id,
        name,
        city: input.city ?? null,
        state: input.state ?? null,
        country,
        address: input.address ?? null,
        latitude: String(input.latitude),
        longitude: String(input.longitude),
        holeCount: input.holeCount,
        onboardingStatus: "scorecard",
        updatedAt: new Date(),
      })
      .where(eq(golfCourses.id, existing.id))
      .returning();

    revalidatePath("/dashboard/courses");
    return { success: true, courseId: updated.id };
  }

  const [created] = await getDb()
    .insert(golfCourses)
    .values({
      orgId: org.id,
      externalCourseId,
      name,
      city: input.city ?? null,
      state: input.state ?? null,
      country,
      address: input.address ?? null,
      latitude: String(input.latitude),
      longitude: String(input.longitude),
      holeCount: input.holeCount,
      onboardingStatus: "scorecard",
      status: "draft",
    })
    .returning();

  revalidatePath("/dashboard/courses");
  return { success: true, courseId: created.id };
}

export async function updateCourseOnboardingDetails(
  courseId: string,
  input: {
    name: string;
    city?: string | null;
    state?: string | null;
    country?: CourseCountry | null;
    address?: string | null;
    latitude: number;
    longitude: number;
    holeCount: 9 | 18;
  }
): Promise<OnboardingActionResult> {
  const allowVerifiedEdit = await canEditVerifiedCourse(courseId);
  const course = await getEditableOnboardingCourse(courseId);

  if (!course) {
    return { success: false, error: "Course not found." };
  }

  const verifiedError = verifiedCourseEditError(
    course.onboardingStatus,
    allowVerifiedEdit
  );
  if (verifiedError) {
    return { success: false, error: verifiedError };
  }

  const country = parseCourseCountry(input.country ?? "US");
  const duplicates = await findDuplicateCourses({
    name: input.name,
    city: input.city,
    state: input.state,
    country,
    excludeCourseId: courseId,
  });
  const exactDuplicate = duplicates.find((match) => match.matchType === "exact");
  if (exactDuplicate) {
    return { success: false, error: duplicateCourseError(duplicates) };
  }

  await getDb()
    .update(golfCourses)
    .set({
      name: input.name.trim(),
      city: input.city ?? null,
      state: input.state ?? null,
      country,
      address: input.address ?? null,
      latitude: String(input.latitude),
      longitude: String(input.longitude),
      holeCount: input.holeCount,
      updatedAt: new Date(),
    })
    .where(eq(golfCourses.id, courseId));

  if (input.holeCount !== course.holeCount) {
    const holes = holeNumbersForCount(input.holeCount).map((holeNumber) => {
      const existing = course.courseHoles.find(
        (hole) => hole.holeNumber === holeNumber
      );
      return {
        holeNumber,
        par: existing?.par ?? 4,
        yardage: existing?.yardage ?? null,
        teeYardages: existing?.teeYardages ?? null,
        strokeIndex: existing?.strokeIndex ?? holeNumber,
      };
    });
    await replaceCourseHoles(courseId, holes);
  }

  revalidatePath(`/dashboard/courses/${courseId}/onboard`);
  return { success: true, courseId };
}

export async function saveCourseOnboardingScorecardImage(
  courseId: string,
  imageDataUrl: string
): Promise<OnboardingActionResult> {
  const course = await getEditableOnboardingCourse(courseId);

  if (!course) {
    return { success: false, error: "Course not found." };
  }

  if (!imageDataUrl.startsWith("data:image/")) {
    return { success: false, error: "Upload a valid image file." };
  }

  await getDb()
    .update(golfCourses)
    .set({
      scorecardImageUrl: imageDataUrl,
      onboardingStatus:
        course.onboardingStatus === "draft" ? "scorecard" : course.onboardingStatus,
      updatedAt: new Date(),
    })
    .where(eq(golfCourses.id, courseId));

  revalidatePath(`/dashboard/courses/${courseId}/onboard`);
  return { success: true, courseId };
}

export async function saveCourseOnboardingScorecard(
  courseId: string,
  input: {
    tees: CourseTeeInput[];
    holes: {
      holeNumber: number;
      par: number;
      teeYardages: Record<string, number | null>;
      strokeIndex: number | null;
    }[];
  }
): Promise<OnboardingActionResult> {
  const course = await getEditableOnboardingCourse(courseId);

  if (!course) {
    return { success: false, error: "Course not found." };
  }

  const tees = input.tees
    .map((tee, index) => ({
      ...tee,
      teeKey: normalizeTeeKey(tee.teeKey || tee.teeName),
      teeName: tee.teeName.trim(),
      sortOrder: tee.sortOrder ?? index,
    }))
    .filter((tee) => tee.teeKey.length > 0 && tee.teeName.length > 0);

  if (tees.length === 0) {
    return { success: false, error: "Add at least one tee set." };
  }

  const teeKeys = new Set(tees.map((tee) => tee.teeKey));
  if (teeKeys.size !== tees.length) {
    return { success: false, error: "Each tee must have a unique name." };
  }

  if (input.holes.length !== course.holeCount) {
    return {
      success: false,
      error: `Enter scorecard data for all ${course.holeCount} holes.`,
    };
  }

  for (const hole of input.holes) {
    if (hole.par < 3 || hole.par > 5) {
      return {
        success: false,
        error: `Hole ${hole.holeNumber} must have par between 3 and 5.`,
      };
    }

    for (const tee of tees) {
      const yardage = hole.teeYardages[tee.teeKey];
      if (yardage == null || yardage <= 0) {
        return {
          success: false,
          error: `Enter yardage for hole ${hole.holeNumber} on ${tee.teeName} tees.`,
        };
      }
    }
  }

  const normalizedHoles = input.holes.map((hole) => {
    const teeYardages = Object.fromEntries(
      tees.map((tee) => [tee.teeKey, hole.teeYardages[tee.teeKey] as number])
    );
    const primaryTeeKey = sortCourseTees(tees)[0]?.teeKey;
    const yardage = primaryTeeKey ? teeYardages[primaryTeeKey] : null;

    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      yardage,
      teeYardages,
      strokeIndex: hole.strokeIndex,
    };
  });

  const teesWithTotals = sortCourseTees(tees).map((tee) => ({
    ...tee,
    totalYardage: totalYardageForTee(tee.teeKey, normalizedHoles),
  }));

  await replaceCourseTees(courseId, teesWithTotals);
  await replaceCourseHoles(courseId, normalizedHoles);

  await getDb()
    .update(golfCourses)
    .set({
      onboardingStatus:
        course.onboardingStatus === "verified"
          ? "verified"
          : "mapping",
      updatedAt: new Date(),
    })
    .where(eq(golfCourses.id, courseId));

  revalidatePath(`/dashboard/courses/${courseId}/onboard`);
  return { success: true, courseId };
}

export async function saveCourseOnboardingHolePin(
  courseId: string,
  holeNumber: number,
  pin:
    | { kind: "green"; lat: number; lng: number }
    | { kind: "tee"; teeKey: string; lat: number; lng: number }
    | { kind: "line_break"; lat: number; lng: number }
): Promise<OnboardingActionResult> {
  const course = await getEditableOnboardingCourse(courseId);

  if (!course) {
    return { success: false, error: "Course not found." };
  }

  if (holeNumber < 1 || holeNumber > course.holeCount) {
    return { success: false, error: "Invalid hole number." };
  }

  if (pin.kind === "green") {
    await saveManualGreenPin(courseId, holeNumber, pin);
  } else if (pin.kind === "tee") {
    const teeExists = course.courseTees.some((tee) => tee.teeKey === pin.teeKey);
    if (!teeExists) {
      return { success: false, error: "Unknown tee set." };
    }
    await saveManualTeePin(courseId, holeNumber, pin.teeKey, pin);
  } else {
    await saveManualLineBreak(courseId, holeNumber, pin);
  }

  revalidatePath(`/dashboard/courses/${courseId}/onboard`);
  return { success: true, courseId };
}

export async function prefillCourseOnboardingFromOsm(
  courseId: string
): Promise<OsmPrefillActionResult> {
  const allowVerifiedEdit = await canEditVerifiedCourse(courseId);
  const course = await getEditableOnboardingCourse(courseId);

  if (!course) {
    return { success: false, error: "Course not found." };
  }

  const verifiedError = verifiedCourseEditError(
    course.onboardingStatus,
    allowVerifiedEdit
  );
  if (verifiedError) {
    return { success: false, error: verifiedError };
  }

  if (course.courseTees.length === 0) {
    return {
      success: false,
      error: "Save the scorecard with tee sets before prefilling hole mapping.",
    };
  }

  const latitude = parseCoordinate(course.latitude);
  const longitude = parseCoordinate(course.longitude);

  if (latitude == null || longitude == null) {
    return {
      success: false,
      error: "Course coordinates are required to query OpenStreetMap.",
    };
  }

  try {
    const { coverage, appliedHoleCount } = await applyOsmOnboardingPrefill({
      courseId,
      latitude,
      longitude,
      holeCount: course.holeCount,
      courseHoles: course.courseHoles,
      courseTees: course.courseTees,
    });

    if (appliedHoleCount === 0) {
      return {
        success: false,
        error:
          coverage.overpassError ??
          "No mappable holes were found in OpenStreetMap near this course.",
      };
    }

    revalidatePath(`/dashboard/courses/${courseId}/onboard`);
    return {
      success: true,
      courseId,
      coverage,
      appliedHoleCount,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not prefill from OpenStreetMap.",
    };
  }
}

export async function extractCourseOnboardingScorecard(
  courseId: string,
  imageDataUrl?: string,
  requestedTees?: CourseTeeInput[]
): Promise<ScorecardOcrActionResult> {
  const course = await getEditableOnboardingCourse(courseId);

  if (!course) {
    return { success: false, error: "Course not found." };
  }

  const tees = (requestedTees ?? [])
    .map((tee, index) => ({
      ...tee,
      teeKey: normalizeTeeKey(tee.teeKey || tee.teeName),
      teeName: tee.teeName.trim(),
      sortOrder: tee.sortOrder ?? index,
    }))
    .filter((tee) => tee.teeKey.length > 0 && tee.teeName.length > 0);

  if (tees.length === 0) {
    return {
      success: false,
      error: "Select the tee colors on this scorecard before extracting.",
    };
  }

  let imageUrl = imageDataUrl?.trim() || null;

  if (!imageUrl) {
    const row = await getDb().query.golfCourses.findFirst({
      where: eq(golfCourses.id, courseId),
      columns: { scorecardImageUrl: true },
    });
    imageUrl = row?.scorecardImageUrl ?? null;
  }

  if (!imageUrl) {
    return {
      success: false,
      error: "Upload a scorecard image before extracting data.",
    };
  }

  try {
    const data = await extractScorecardFromImage(
      imageUrl,
      course.holeCount,
      tees
    );
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not extract scorecard data.",
    };
  }
}

export async function submitCourseForVerification(
  courseId: string
): Promise<OnboardingActionResult> {
  const course = await getEditableOnboardingCourse(courseId);

  if (!course) {
    return { success: false, error: "Course not found." };
  }

  const bundle = await getCourseOnboardingBundle(courseId);
  if (!bundle) {
    return { success: false, error: "Course not found." };
  }

  const mappingProgress = countCourseMappingProgress(
    bundle,
    bundle.courseTees,
    bundle.greenTargets,
    bundle.holeFeatures
  );

  const step = onboardingStepForCourse(
    bundle,
    bundle.courseHoles,
    bundle.courseTees,
    mappingProgress
  );

  if (step !== "review") {
    return {
      success: false,
      error: "Complete course details, scorecard, and hole mapping before submitting.",
    };
  }

  await getDb()
    .update(golfCourses)
    .set({
      onboardingStatus: "submitted",
      submittedAt: new Date(),
      reviewNotes: null,
      updatedAt: new Date(),
    })
    .where(eq(golfCourses.id, courseId));

  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/admin/courses");
  revalidatePath(`/dashboard/courses/${courseId}/onboard`);
  return { success: true, courseId };
}

export async function verifySubmittedCourse(
  courseId: string
): Promise<OnboardingActionResult> {
  const adminId = await requirePlatformAdmin();

  const course = await getDb().query.golfCourses.findFirst({
    where: eq(golfCourses.id, courseId),
  });

  if (!course) {
    return { success: false, error: "Course not found." };
  }

  if (course.onboardingStatus !== "submitted") {
    return { success: false, error: "Course is not awaiting verification." };
  }

  if (course.mappedHoleCount <= 0) {
    return { success: false, error: "Course has no mapped holes." };
  }

  const holeNumbers = holeNumbersForCount(course.holeCount);
  const { seedElevationForCourse } = await import("@/lib/golf-courses");
  await seedElevationForCourse(courseId, holeNumbers);

  await getDb()
    .update(golfCourses)
    .set({
      onboardingStatus: "verified",
      status: "published",
      dataQuality: "full",
      verifiedAt: new Date(),
      verifiedByClerkId: adminId,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(golfCourses.id, courseId));

  revalidatePath("/dashboard/admin/courses");
  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${courseId}/onboard`);
  return { success: true, courseId };
}

export async function rejectSubmittedCourse(
  courseId: string,
  notes: string
): Promise<OnboardingActionResult> {
  await requirePlatformAdmin();

  const course = await getDb().query.golfCourses.findFirst({
    where: eq(golfCourses.id, courseId),
  });

  if (!course) {
    return { success: false, error: "Course not found." };
  }

  if (course.onboardingStatus !== "submitted") {
    return { success: false, error: "Course is not awaiting verification." };
  }

  await getDb()
    .update(golfCourses)
    .set({
      onboardingStatus: "rejected",
      reviewNotes: notes.trim() || "Please review and resubmit.",
      updatedAt: new Date(),
    })
    .where(eq(golfCourses.id, courseId));

  revalidatePath("/dashboard/admin/courses");
  revalidatePath(`/dashboard/courses/${courseId}/onboard`);
  return { success: true, courseId };
}

