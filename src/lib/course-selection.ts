import type { ScorecardHoleSnapshot } from "@/lib/scorecard";
import {
  buildScorecardForTee,
  type CourseDetail,
  type CourseTeeOption,
} from "@/lib/course-catalog";

export type CourseSelection = {
  courseName: string;
  externalCourseId: string | null;
  nineSide: "front" | "back" | null;
  scorecardHoles: ScorecardHoleSnapshot[];
  courseAddress?: string | null;
  courseCity?: string | null;
  courseState?: string | null;
  coursePhone?: string | null;
  courseWebsite?: string | null;
  selectedTeeKey?: string | null;
  teeName?: string | null;
  courseRating?: string | null;
  courseSlope?: number | null;
  courseTotalYardage?: number | null;
};

export function emptyCourseSelection(
  courseName = ""
): CourseSelection {
  return {
    courseName,
    externalCourseId: null,
    nineSide: null,
    scorecardHoles: [],
    courseAddress: null,
    courseCity: null,
    courseState: null,
    coursePhone: null,
    courseWebsite: null,
    selectedTeeKey: null,
    teeName: null,
    courseRating: null,
    courseSlope: null,
    courseTotalYardage: null,
  };
}

function teeStats(tee: CourseTeeOption | null | undefined) {
  if (!tee) {
    return {
      teeName: null,
      courseRating: null,
      courseSlope: null,
      courseTotalYardage: null,
    };
  }

  return {
    teeName: tee.tee_name,
    courseRating:
      tee.course_rating != null ? String(tee.course_rating) : null,
    courseSlope: tee.slope ?? null,
    courseTotalYardage: tee.yardage ?? null,
  };
}

export function buildCourseSelection(
  course: CourseDetail,
  teeKey: string | null,
  options: {
    holes: "9" | "18";
    nineSide: "front" | "back";
  }
): CourseSelection {
  const tee = course.tees?.find((entry) => entry.tee_key === teeKey) ?? null;
  const scorecard = buildScorecardForTee(course, teeKey, {
    holes: options.holes,
    nineSide: options.holes === "9" ? options.nineSide : null,
  });

  const snapshot: ScorecardHoleSnapshot[] = scorecard.map((hole) => ({
    holeNumber: hole.hole,
    par: hole.par,
    yardage: hole.yardage ?? null,
    strokeIndex: hole.handicap_index ?? null,
  }));

  return {
    courseName: course.name,
    externalCourseId: course.id,
    nineSide: options.holes === "9" ? options.nineSide : null,
    scorecardHoles: snapshot,
    courseAddress: course.address ?? null,
    courseCity: course.city ?? null,
    courseState: course.state ?? null,
    coursePhone: course.phone ?? null,
    courseWebsite: course.website ?? null,
    selectedTeeKey: teeKey,
    ...teeStats(tee),
  };
}

export function courseSelectionFromEvent(event: {
  courseName: string;
  externalCourseId: string | null;
  nineSide: "front" | "back" | null;
  courseAddress?: string | null;
  courseCity?: string | null;
  courseState?: string | null;
  coursePhone?: string | null;
  courseWebsite?: string | null;
  selectedTeeKey?: string | null;
  teeName?: string | null;
  courseRating?: string | null;
  courseSlope?: number | null;
  courseTotalYardage?: number | null;
  eventHoles?: {
    holeNumber: number;
    par: number;
    yardage: number | null;
    strokeIndex: number | null;
  }[];
}): CourseSelection {
  return {
    courseName: event.courseName,
    externalCourseId: event.externalCourseId,
    nineSide: event.nineSide,
    scorecardHoles:
      event.eventHoles?.map((hole) => ({
        holeNumber: hole.holeNumber,
        par: hole.par,
        yardage: hole.yardage,
        strokeIndex: hole.strokeIndex,
      })) ?? [],
    courseAddress: event.courseAddress ?? null,
    courseCity: event.courseCity ?? null,
    courseState: event.courseState ?? null,
    coursePhone: event.coursePhone ?? null,
    courseWebsite: event.courseWebsite ?? null,
    selectedTeeKey: event.selectedTeeKey ?? null,
    teeName: event.teeName ?? null,
    courseRating: event.courseRating ?? null,
    courseSlope: event.courseSlope ?? null,
    courseTotalYardage: event.courseTotalYardage ?? null,
  };
}

export function formatCourseLocation(
  selection: Pick<CourseSelection, "courseCity" | "courseState">
): string | null {
  const parts = [selection.courseCity, selection.courseState].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function formatTeeSummary(
  selection: Pick<
    CourseSelection,
    "teeName" | "courseTotalYardage" | "courseRating" | "courseSlope"
  >
): string | null {
  if (!selection.teeName) return null;

  const parts = [selection.teeName];
  if (selection.courseTotalYardage) {
    parts.push(`${selection.courseTotalYardage.toLocaleString()} yds`);
  }
  if (selection.courseRating && selection.courseSlope) {
    parts.push(`${selection.courseRating}/${selection.courseSlope}`);
  }
  return parts.join(" · ");
}
