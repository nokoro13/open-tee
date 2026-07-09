"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { events, golfCourses, mappingRequests } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { seedCourseMapHoles } from "@/lib/course-map-seed";
import { eventHoleToCourseHole, parseCoordinate } from "@/lib/green-distance";
import {
  getGolfCourseByExternalId,
  getMappingRequestForOrg,
  persistSeedResult,
  seedElevationForCourse,
} from "@/lib/golf-courses";
import { isLocalCourseId } from "@/lib/local-course";
import {
  extractOpenGolfCourseCoordinates,
  getOpenGolfCourse,
} from "@/lib/opengolfapi";
import { fetchOsmGolfFeaturesNear } from "@/lib/overpass-golf";
import type { CourseMapSeedMeta } from "@/lib/course-map-seed";

export type ActionResult =
  | { success: true; seedMeta?: CourseMapSeedMeta }
  | { success: false; error: string };

async function getOwnedEvent(eventId: string, orgId: string) {
  return getDb().query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.orgId, orgId)),
    with: { eventHoles: true },
  });
}

function courseHoleNumbersForEvent(event: {
  holes: "9" | "18";
  nineSide?: "front" | "back" | null;
  eventHoles?: { holeNumber: number }[];
}) {
  const eventHoles = event.eventHoles?.length
    ? [...event.eventHoles]
        .sort((a, b) => a.holeNumber - b.holeNumber)
        .map((hole) => hole.holeNumber)
    : event.holes === "18"
      ? Array.from({ length: 18 }, (_, index) => index + 1)
      : Array.from({ length: 9 }, (_, index) => index + 1);

  return [
    ...new Set(
      eventHoles.map((hole) =>
        eventHoleToCourseHole(hole, {
          holes: event.holes,
          nineSide: event.nineSide,
        })
      )
    ),
  ].sort((a, b) => a - b);
}

async function resolveCourseCoordinates(event: {
  externalCourseId: string;
  courseName: string;
}) {
  if (isLocalCourseId(event.externalCourseId)) {
    const existing = await getGolfCourseByExternalId(event.externalCourseId);
    return {
      latitude: parseCoordinate(existing?.latitude ?? null),
      longitude: parseCoordinate(existing?.longitude ?? null),
    };
  }

  const course = await getOpenGolfCourse(event.externalCourseId);
  return extractOpenGolfCourseCoordinates(course);
}

async function ensureGolfCourse(event: {
  externalCourseId: string;
  courseName: string;
  courseCity?: string | null;
  courseState?: string | null;
}) {
  const coords = await resolveCourseCoordinates(event);

  let course = await getGolfCourseByExternalId(event.externalCourseId);
  if (!course) {
    const [created] = await getDb()
      .insert(golfCourses)
      .values({
        externalCourseId: event.externalCourseId,
        name: event.courseName,
        city: event.courseCity ?? null,
        state: event.courseState ?? null,
        latitude: coords.latitude != null ? String(coords.latitude) : null,
        longitude: coords.longitude != null ? String(coords.longitude) : null,
        status: "draft",
      })
      .returning();
    course = created;
  } else if (
    coords.latitude != null &&
    coords.longitude != null &&
    (!course.latitude || !course.longitude)
  ) {
    const [updated] = await getDb()
      .update(golfCourses)
      .set({
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
        updatedAt: new Date(),
      })
      .where(eq(golfCourses.id, course.id))
      .returning();
    course = updated;
  }

  return course;
}

async function runSeedForCourse(
  courseId: string,
  event: {
    externalCourseId: string;
    holes: "9" | "18";
    nineSide?: "front" | "back" | null;
    eventHoles?: { holeNumber: number }[];
  }
) {
  const course = await getDb().query.golfCourses.findFirst({
    where: eq(golfCourses.id, courseId),
  });
  if (!course) throw new Error("Course not found.");

  const holeNumbers = courseHoleNumbersForEvent(event);
  const latitude = parseCoordinate(course.latitude);
  const longitude = parseCoordinate(course.longitude);

  const seed = await seedCourseMapHoles({
    externalCourseId: event.externalCourseId,
    courseHoleNumbers: holeNumbers,
    courseLatitude: latitude,
    courseLongitude: longitude,
  });

  const mappedCount = await persistSeedResult(courseId, holeNumbers, seed);

  return { seed, mappedCount };
}

export async function requestCourseMapping(
  eventId: string
): Promise<ActionResult & { requestId?: string }> {
  const org = await requireOrganization();
  const event = await getOwnedEvent(eventId, org.id);

  if (!event) return { success: false, error: "Event not found." };
  if (!event.externalCourseId) {
    return {
      success: false,
      error: "Link this event to a course from search before requesting Caddie mapping.",
    };
  }

  const published = await getDb().query.golfCourses.findFirst({
    where: and(
      eq(golfCourses.externalCourseId, event.externalCourseId),
      eq(golfCourses.status, "published")
    ),
  });

  if (published) {
    return { success: false, error: "Caddie Mode is already available for this course." };
  }

  const existingPending = await getDb().query.mappingRequests.findFirst({
    where: and(
      eq(mappingRequests.eventId, eventId),
      eq(mappingRequests.orgId, org.id)
    ),
    orderBy: [desc(mappingRequests.requestedAt)],
  });

  if (
    existingPending &&
    (existingPending.status === "pending" || existingPending.status === "draft_ready")
  ) {
    return { success: true, requestId: existingPending.id };
  }

  const course = await ensureGolfCourse({
    externalCourseId: event.externalCourseId,
    courseName: event.courseName,
    courseCity: event.courseCity,
    courseState: event.courseState,
  });

  const [request] = await getDb()
    .insert(mappingRequests)
    .values({
      orgId: org.id,
      eventId: event.id,
      courseId: course.id,
      externalCourseId: event.externalCourseId,
      courseName: event.courseName,
      status: "pending",
    })
    .returning();

  const { seed, mappedCount } = await runSeedForCourse(course.id, {
    externalCourseId: event.externalCourseId,
    holes: event.holes,
    nineSide: event.nineSide,
    eventHoles: event.eventHoles,
  });

  await getDb()
    .update(mappingRequests)
    .set({
      status: mappedCount > 0 ? "draft_ready" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(mappingRequests.id, request.id));

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath("/dashboard/mapping");
  revalidatePath(`/dashboard/mapping/${request.id}`);

  return { success: true, requestId: request.id, seedMeta: seed.meta };
}

export async function reseedCourseMappingDraft(
  requestId: string
): Promise<ActionResult> {
  const org = await requireOrganization();
  const request = await getMappingRequestForOrg(requestId, org.id);

  if (!request) return { success: false, error: "Mapping request not found." };

  const event = await getOwnedEvent(request.eventId, org.id);
  if (!event) return { success: false, error: "Event not found." };

  const externalCourseId = event.externalCourseId ?? request.externalCourseId;
  if (!externalCourseId) {
    return { success: false, error: "Event is not linked to a course." };
  }

  const { seed, mappedCount } = await runSeedForCourse(request.courseId, {
    externalCourseId,
    holes: event.holes,
    nineSide: event.nineSide,
    eventHoles: event.eventHoles,
  });

  await getDb()
    .update(mappingRequests)
    .set({
      status: mappedCount > 0 ? "draft_ready" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(mappingRequests.id, requestId));

  revalidatePath(`/dashboard/mapping/${requestId}`);
  revalidatePath(`/dashboard/events/${request.eventId}`);

  return { success: true, seedMeta: seed.meta };
}

export async function publishCourseMapping(
  requestId: string
): Promise<ActionResult> {
  const org = await requireOrganization();
  const request = await getMappingRequestForOrg(requestId, org.id);

  if (!request) return { success: false, error: "Mapping request not found." };
  if (request.course.mappedHoleCount === 0) {
    return {
      success: false,
      error: "Add at least one mapped hole before publishing.",
    };
  }

  const event = await getOwnedEvent(request.eventId, org.id);
  if (!event) return { success: false, error: "Event not found." };

  const holeNumbers = courseHoleNumbersForEvent(event);
  await seedElevationForCourse(request.courseId, holeNumbers);

  const now = new Date();

  await getDb()
    .update(golfCourses)
    .set({
      status: "published",
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(golfCourses.id, request.courseId));

  await getDb()
    .update(mappingRequests)
    .set({
      status: "published",
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(mappingRequests.id, requestId));

  revalidatePath(`/dashboard/mapping/${requestId}`);
  revalidatePath("/dashboard/mapping");
  revalidatePath(`/dashboard/events/${request.eventId}`);
  revalidatePath(`/e/${request.event.slug}/score`);

  return { success: true };
}

export async function getOsmGreenOptionsForMappingRequest(requestId: string) {
  const org = await requireOrganization();
  const request = await getMappingRequestForOrg(requestId, org.id);
  if (!request) return [];

  const lat = parseCoordinate(request.course.latitude);
  const lng = parseCoordinate(request.course.longitude);
  if (lat == null || lng == null) return [];

  try {
    const features = await fetchOsmGolfFeaturesNear(lat, lng);
    return features
      .filter((feature) => feature.featureType === "green")
      .map((green) => ({
        osmId: green.osmId,
        label: `${green.osmId} (${green.center.lat.toFixed(5)}, ${green.center.lng.toFixed(5)})`,
        lat: green.center.lat,
        lng: green.center.lng,
      }));
  } catch {
    return [];
  }
}
