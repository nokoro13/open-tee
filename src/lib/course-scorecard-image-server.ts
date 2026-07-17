import "server-only";

import { auth } from "@clerk/nextjs/server";
import { del, put } from "@vercel/blob";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { golfCourses } from "@/db/schema";
import {
  activatePendingCourseAccessForUser,
  canUserEditCourse,
} from "@/lib/course-access";
import { requireOrganization } from "@/lib/auth";
import { isBlobScorecardImageUrl } from "@/lib/scorecard-image-url";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function uploadCourseScorecardImage(
  courseId: string,
  file: File
): Promise<{ url: string } | { error: string; status: number }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return {
      error: "File storage is not configured. Add BLOB_READ_WRITE_TOKEN.",
      status: 503,
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized.", status: 401 };
  }

  const org = await requireOrganization();
  await activatePendingCourseAccessForUser(userId);

  const course = await getDb().query.golfCourses.findFirst({
    where: eq(golfCourses.id, courseId),
    columns: {
      id: true,
      orgId: true,
      scorecardImageUrl: true,
      onboardingStatus: true,
    },
  });

  if (!course) {
    return { error: "Course not found.", status: 404 };
  }

  const allowed = await canUserEditCourse({
    userId,
    orgId: org.id,
    courseId: course.id,
    courseOrgId: course.orgId,
  });

  if (!allowed) {
    return { error: "Course not found.", status: 404 };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Upload a valid image file.", status: 400 };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: "Scorecard image is too large. Try a smaller photo.",
      status: 413,
    };
  }

  const pathname = `scorecards/${courseId}/${Date.now()}.jpg`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type === "image/png" ? file.type : "image/jpeg",
  });

  const previousUrl = course.scorecardImageUrl;
  if (previousUrl && isBlobScorecardImageUrl(previousUrl)) {
    try {
      await del(previousUrl);
    } catch {
      // Best-effort cleanup of the replaced blob.
    }
  }

  await getDb()
    .update(golfCourses)
    .set({
      scorecardImageUrl: blob.url,
      onboardingStatus:
        course.onboardingStatus === "draft"
          ? "scorecard"
          : course.onboardingStatus,
      updatedAt: new Date(),
    })
    .where(eq(golfCourses.id, courseId));

  return { url: blob.url };
}
