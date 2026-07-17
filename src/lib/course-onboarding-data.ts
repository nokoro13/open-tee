import { asc, desc, eq, and } from "drizzle-orm";

import { getDb } from "@/db";
import {
  courseHoles,
  courseTees,
  golfCourses,
  greenTargets,
  holeFeatures,
} from "@/db/schema";
import { getEditableCoursesForUser } from "@/lib/course-access";
import { requirePlatformAdmin } from "@/lib/platform-admin";

export async function getOnboardingCoursesForOrg(orgId: string) {
  return getDb().query.golfCourses.findMany({
    where: eq(golfCourses.orgId, orgId),
    orderBy: [desc(golfCourses.updatedAt)],
    with: {
      courseTees: true,
      courseHoles: true,
    },
  });
}

export async function getVerifiedCoursesCatalog() {
  return getDb().query.golfCourses.findMany({
    where: and(
      eq(golfCourses.onboardingStatus, "verified"),
      eq(golfCourses.status, "published")
    ),
    orderBy: [asc(golfCourses.name)],
  });
}

export async function getVerifiedCourseForPreview(courseId: string) {
  return getDb().query.golfCourses.findFirst({
    where: and(
      eq(golfCourses.id, courseId),
      eq(golfCourses.onboardingStatus, "verified"),
      eq(golfCourses.status, "published")
    ),
    with: {
      organization: true,
      courseTees: {
        orderBy: [asc(courseTees.sortOrder), asc(courseTees.teeName)],
      },
      courseHoles: {
        orderBy: [asc(courseHoles.holeNumber)],
      },
      holeFeatures: {
        orderBy: [asc(holeFeatures.holeNumber)],
      },
      greenTargets: {
        orderBy: [asc(greenTargets.holeNumber)],
      },
    },
  });
}

export async function getEditableInProgressCourses(userId: string, orgId: string) {
  const editable = await getEditableCoursesForUser(userId, orgId);
  return editable.filter((course) => course.onboardingStatus !== "verified");
}

export async function getSubmittedCoursesForAdmin() {
  await requirePlatformAdmin();

  return getDb().query.golfCourses.findMany({
    where: eq(golfCourses.onboardingStatus, "submitted"),
    orderBy: [desc(golfCourses.submittedAt)],
    with: {
      courseHoles: true,
      courseTees: true,
      organization: true,
    },
  });
}

export async function getCourseForAdminReview(courseId: string) {
  await requirePlatformAdmin();

  return getDb().query.golfCourses.findFirst({
    where: eq(golfCourses.id, courseId),
    with: {
      organization: true,
      courseTees: {
        orderBy: [asc(courseTees.sortOrder), asc(courseTees.teeName)],
      },
      courseHoles: {
        orderBy: [asc(courseHoles.holeNumber)],
      },
      holeFeatures: {
        orderBy: [asc(holeFeatures.holeNumber)],
      },
      greenTargets: {
        orderBy: [asc(greenTargets.holeNumber)],
      },
    },
  });
}
