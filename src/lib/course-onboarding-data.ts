import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { golfCourses } from "@/db/schema";
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

export async function getSubmittedCoursesForAdmin() {
  await requirePlatformAdmin();

  return getDb().query.golfCourses.findMany({
    where: eq(golfCourses.onboardingStatus, "submitted"),
    orderBy: [desc(golfCourses.submittedAt)],
    with: {
      courseHoles: true,
      organization: true,
    },
  });
}
