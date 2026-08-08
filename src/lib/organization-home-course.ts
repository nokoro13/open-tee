import type { Organization } from "@/db/schema";
import { pickDefaultTeeKey } from "@/lib/course-catalog";
import { getCourseDetailByExternalId } from "@/lib/course-onboarding";
import {
  buildCourseSelection,
  emptyCourseSelection,
  type CourseSelection,
} from "@/lib/course-selection";

export function homeCourseSelectionSeedFromOrganization(
  org: Pick<Organization, "homeExternalCourseId" | "homeSelectedTeeKey">
): CourseSelection {
  if (!org.homeExternalCourseId) {
    return emptyCourseSelection();
  }

  return {
    ...emptyCourseSelection(),
    externalCourseId: org.homeExternalCourseId,
    selectedTeeKey: org.homeSelectedTeeKey,
  };
}

export async function resolveOrganizationHomeCourseSelection(
  org: Pick<Organization, "homeExternalCourseId" | "homeSelectedTeeKey">,
  options: {
    holes?: "9" | "18";
    nineSide?: "front" | "back";
  } = {}
): Promise<CourseSelection | null> {
  if (!org.homeExternalCourseId) {
    return null;
  }

  const course = await getCourseDetailByExternalId(org.homeExternalCourseId);
  if (!course) {
    return null;
  }

  const teeKey =
    org.homeSelectedTeeKey ?? pickDefaultTeeKey(course.tees) ?? null;
  const holes = options.holes ?? "18";
  const nineSide = options.nineSide ?? "front";

  return buildCourseSelection(course, teeKey, { holes, nineSide });
}

export function homeCourseFieldsFromSelection(selection: CourseSelection): {
  homeExternalCourseId: string | null;
  homeSelectedTeeKey: string | null;
} {
  const homeExternalCourseId = selection.externalCourseId?.trim() || null;

  return {
    homeExternalCourseId,
    homeSelectedTeeKey: homeExternalCourseId
      ? selection.selectedTeeKey ?? null
      : null,
  };
}
