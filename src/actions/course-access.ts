"use server";

import { revalidatePath } from "next/cache";

import {
  getCourseAccessForCourse,
  revokeCourseAccessGrant,
  upsertCourseAccessInvite,
} from "@/lib/course-access";
import { requirePlatformAdmin } from "@/lib/platform-admin";

export type CourseAccessActionResult =
  | { success: true; activatedImmediately: boolean }
  | { success: false; error: string };

export async function inviteCourseEditor(
  courseId: string,
  email: string
): Promise<CourseAccessActionResult> {
  const adminId = await requirePlatformAdmin();

  try {
    const { activatedImmediately } = await upsertCourseAccessInvite({
      courseId,
      inviteEmail: email,
      invitedByClerkId: adminId,
      role: "course_admin",
    });

    revalidatePath(`/dashboard/courses/${courseId}/onboard`);
    revalidatePath("/dashboard/courses");
    return { success: true, activatedImmediately };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not invite course editor.",
    };
  }
}

export async function revokeCourseEditor(
  grantId: string,
  courseId: string
): Promise<CourseAccessActionResult> {
  await requirePlatformAdmin();

  try {
    await revokeCourseAccessGrant(grantId);
    revalidatePath(`/dashboard/courses/${courseId}/onboard`);
    revalidatePath("/dashboard/courses");
    return { success: true, activatedImmediately: false };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not revoke course access.",
    };
  }
}

export async function listCourseAccessGrants(courseId: string) {
  await requirePlatformAdmin();
  return getCourseAccessForCourse(courseId);
}
