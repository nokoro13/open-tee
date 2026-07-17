export const LOCAL_COURSE_PREFIX = "local:";

export function isLocalCourseId(
  externalCourseId: string | null | undefined
): boolean {
  return externalCourseId?.startsWith(LOCAL_COURSE_PREFIX) ?? false;
}

export function createLocalCourseId(): string {
  return `${LOCAL_COURSE_PREFIX}${crypto.randomUUID()}`;
}
