import { isGoogleCourseId } from "@/lib/google-course-id";

export function requiresGooglePlacesSaveConfirmation(
  externalCourseId: string | null | undefined
): boolean {
  return isGoogleCourseId(externalCourseId);
}

export function googlePlacesSaveConfirmationError(): string {
  return "Confirm the course details before saving a Google-linked course.";
}
