import "server-only";

import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";

import { getDb } from "@/db";
import {
  courseAccess,
  golfCourses,
  type CourseAccess,
  type GolfCourse,
} from "@/db/schema";
import { normalizeInviteEmail } from "@/lib/course-access-utils";
import { isPlatformAdmin } from "@/lib/platform-admin";

export type CourseAccessGrant = CourseAccess;

export { normalizeInviteEmail } from "@/lib/course-access-utils";

export async function getActiveCourseAccessForUser(
  userId: string
): Promise<CourseAccessGrant[]> {
  return getDb().query.courseAccess.findMany({
    where: and(
      eq(courseAccess.clerkUserId, userId),
      eq(courseAccess.status, "active")
    ),
    orderBy: [desc(courseAccess.acceptedAt), desc(courseAccess.createdAt)],
  });
}

export async function hasActiveCourseAccess(
  userId: string,
  courseId: string
): Promise<boolean> {
  const grant = await getDb().query.courseAccess.findFirst({
    where: and(
      eq(courseAccess.courseId, courseId),
      eq(courseAccess.clerkUserId, userId),
      eq(courseAccess.status, "active")
    ),
    columns: { id: true },
  });
  return grant != null;
}

export async function canUserEditCourse(options: {
  userId: string;
  orgId: string;
  courseId: string;
  courseOrgId: string | null;
}): Promise<boolean> {
  if (isPlatformAdmin(options.userId)) return true;
  if (options.courseOrgId && options.courseOrgId === options.orgId) return true;
  return hasActiveCourseAccess(options.userId, options.courseId);
}

export async function canUserEditVerifiedCourse(
  userId: string,
  courseId: string,
  options?: { courseOrgId?: string | null; orgId?: string }
): Promise<boolean> {
  if (isPlatformAdmin(userId)) return true;
  if (
    options?.courseOrgId &&
    options.orgId &&
    options.courseOrgId === options.orgId
  ) {
    return true;
  }
  return hasActiveCourseAccess(userId, courseId);
}

export async function activatePendingCourseAccessForUser(
  userId: string
): Promise<number> {
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? [])
    .map((entry) => normalizeInviteEmail(entry.emailAddress))
    .filter(Boolean);

  if (emails.length === 0) return 0;

  const pending = await getDb().query.courseAccess.findMany({
    where: and(
      eq(courseAccess.status, "pending"),
      inArray(courseAccess.inviteEmail, emails)
    ),
  });

  if (pending.length === 0) return 0;

  let activated = 0;
  for (const grant of pending) {
    const existingActive = await getDb().query.courseAccess.findFirst({
      where: and(
        eq(courseAccess.courseId, grant.courseId),
        eq(courseAccess.clerkUserId, userId),
        eq(courseAccess.status, "active")
      ),
      columns: { id: true },
    });

    if (existingActive) {
      await getDb()
        .update(courseAccess)
        .set({
          status: "revoked",
          updatedAt: new Date(),
        })
        .where(eq(courseAccess.id, grant.id));
      continue;
    }

    await getDb()
      .update(courseAccess)
      .set({
        clerkUserId: userId,
        status: "active",
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(courseAccess.id, grant.id));
    activated += 1;
  }

  return activated;
}

export async function getCourseAccessForCourse(courseId: string) {
  return getDb().query.courseAccess.findMany({
    where: and(
      eq(courseAccess.courseId, courseId),
      or(eq(courseAccess.status, "active"), eq(courseAccess.status, "pending"))
    ),
    orderBy: [desc(courseAccess.createdAt)],
  });
}

export async function getEditableCoursesForUser(
  userId: string,
  orgId: string
): Promise<
  (GolfCourse & {
    accessType: "owned" | "granted";
  })[]
> {
  await activatePendingCourseAccessForUser(userId);

  const owned = await getDb().query.golfCourses.findMany({
    where: eq(golfCourses.orgId, orgId),
    orderBy: [desc(golfCourses.updatedAt)],
  });

  const grants = await getActiveCourseAccessForUser(userId);
  const grantedCourseIds = grants
    .map((grant) => grant.courseId)
    .filter((courseId) => !owned.some((course) => course.id === courseId));

  const granted =
    grantedCourseIds.length > 0
      ? await getDb().query.golfCourses.findMany({
          where: inArray(golfCourses.id, grantedCourseIds),
          orderBy: [desc(golfCourses.updatedAt)],
        })
      : [];

  return [
    ...owned.map((course) => ({ ...course, accessType: "owned" as const })),
    ...granted.map((course) => ({ ...course, accessType: "granted" as const })),
  ].sort(
    (left, right) =>
      right.updatedAt.getTime() - left.updatedAt.getTime()
  );
}

export async function lookupClerkUserIdByEmail(
  email: string
): Promise<string | null> {
  const normalized = normalizeInviteEmail(email);
  if (!normalized) return null;

  try {
    const client = await clerkClient();
    const result = await client.users.getUserList({
      emailAddress: [normalized],
      limit: 1,
    });
    return result.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function upsertCourseAccessInvite(input: {
  courseId: string;
  inviteEmail: string;
  invitedByClerkId: string;
  role?: "course_admin" | "course_editor";
}): Promise<{ grant: CourseAccessGrant; activatedImmediately: boolean }> {
  const inviteEmail = normalizeInviteEmail(input.inviteEmail);
  if (!inviteEmail || !inviteEmail.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  const clerkUserId = await lookupClerkUserIdByEmail(inviteEmail);
  const now = new Date();

  if (clerkUserId) {
    const existing = await getDb().query.courseAccess.findFirst({
      where: and(
        eq(courseAccess.courseId, input.courseId),
        eq(courseAccess.clerkUserId, clerkUserId)
      ),
    });

    if (existing) {
      const [updated] = await getDb()
        .update(courseAccess)
        .set({
          inviteEmail,
          role: input.role ?? "course_admin",
          status: "active",
          invitedByClerkId: input.invitedByClerkId,
          acceptedAt: existing.acceptedAt ?? now,
          updatedAt: now,
        })
        .where(eq(courseAccess.id, existing.id))
        .returning();

      return { grant: updated, activatedImmediately: true };
    }

    const [created] = await getDb()
      .insert(courseAccess)
      .values({
        courseId: input.courseId,
        clerkUserId,
        inviteEmail,
        role: input.role ?? "course_admin",
        status: "active",
        invitedByClerkId: input.invitedByClerkId,
        acceptedAt: now,
      })
      .returning();

    return { grant: created, activatedImmediately: true };
  }

  const existingPending = await getDb().query.courseAccess.findFirst({
    where: and(
      eq(courseAccess.courseId, input.courseId),
      eq(courseAccess.inviteEmail, inviteEmail)
    ),
  });

  if (existingPending) {
    const [updated] = await getDb()
      .update(courseAccess)
      .set({
        role: input.role ?? "course_admin",
        status: "pending",
        invitedByClerkId: input.invitedByClerkId,
        updatedAt: now,
      })
      .where(eq(courseAccess.id, existingPending.id))
      .returning();

    return { grant: updated, activatedImmediately: false };
  }

  const [created] = await getDb()
    .insert(courseAccess)
    .values({
      courseId: input.courseId,
      inviteEmail,
      role: input.role ?? "course_admin",
      status: "pending",
      invitedByClerkId: input.invitedByClerkId,
    })
    .returning();

  return { grant: created, activatedImmediately: false };
}

export async function revokeCourseAccessGrant(grantId: string): Promise<void> {
  await getDb()
    .update(courseAccess)
    .set({
      status: "revoked",
      updatedAt: new Date(),
    })
    .where(eq(courseAccess.id, grantId));
}
