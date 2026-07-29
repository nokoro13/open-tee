export const GOOGLE_COURSE_PREFIX = "google:";

export function isGoogleCourseId(
  externalCourseId: string | null | undefined
): boolean {
  return externalCourseId?.startsWith(GOOGLE_COURSE_PREFIX) ?? false;
}

export function createGoogleCourseId(placeId: string): string {
  const trimmed = placeId.trim();
  if (!trimmed) {
    throw new Error("Google place ID is required.");
  }
  return `${GOOGLE_COURSE_PREFIX}${trimmed}`;
}

export function googlePlaceIdFromExternalCourseId(
  externalCourseId: string | null | undefined
): string | null {
  if (!isGoogleCourseId(externalCourseId)) return null;
  return externalCourseId!.slice(GOOGLE_COURSE_PREFIX.length);
}
