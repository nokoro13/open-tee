import type { ScorecardHoleSnapshot } from "@/lib/scorecard";
import { parseCourseCountry } from "@/lib/course-location";

export type CourseSummary = {
  id: string;
  name: string;
  course_name?: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  par?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  website?: string | null;
  type?: string | null;
  source?: "verified";
};

export type CourseScorecardHole = {
  hole: number;
  par: number;
  yardage?: number | null;
  handicap_index?: number | null;
};

export type CourseHoleData = {
  number: number;
  par: number;
  handicap_index?: number | null;
  yardages?: Record<string, number> | null;
};

export type CourseTeeOption = {
  tee_key: string;
  tee_name: string;
  tee_color?: string | null;
  gender?: string | null;
  course_rating?: number | null;
  slope?: number | null;
  par?: number | null;
  yardage?: number | null;
};

export type CourseDetail = CourseSummary & {
  address?: string | null;
  holes?: number | null;
  yardage?: number | null;
  scorecard?: CourseScorecardHole[];
  holes_data?: CourseHoleData[];
  tees?: CourseTeeOption[];
  lat?: number | null;
  lng?: number | null;
};

const TEE_YARDAGE_PREFERENCE = [
  "white",
  "green",
  "black",
  "blue",
  "gold",
  "silver",
  "brown",
  "red",
  "web",
] as const;

const DEFAULT_TEE_COLOR_PREFERENCE = [
  "white",
  "green",
  "blue",
  "gold",
  "black",
  "silver",
  "red",
  "brown",
  "web",
] as const;

export const STANDARD_SCORECARD_TEE_COLORS = [
  "black",
  "blue",
  "white",
  "red",
] as const;

export type StandardScorecardTeeColor =
  (typeof STANDARD_SCORECARD_TEE_COLORS)[number];

export function extractCourseCoordinates(
  course: CourseDetail | null | undefined
): { latitude: number | null; longitude: number | null } {
  if (!course) return { latitude: null, longitude: null };

  const latitude = course.latitude ?? course.lat ?? null;
  const longitude = course.longitude ?? course.lng ?? null;

  return {
    latitude:
      typeof latitude === "number" && Number.isFinite(latitude) ? latitude : null,
    longitude:
      typeof longitude === "number" && Number.isFinite(longitude)
        ? longitude
        : null,
  };
}

export function pickPreferredTeeYardage(
  yardages: Record<string, number> | null | undefined
): number | null {
  if (!yardages) return null;

  for (const tee of TEE_YARDAGE_PREFERENCE) {
    const value = yardages[tee];
    if (typeof value === "number" && value > 0) {
      return value;
    }
  }

  const values = Object.values(yardages).filter(
    (value): value is number => typeof value === "number" && value > 0
  );
  return values.length > 0 ? values[0] : null;
}

export function yardageForTeeColor(
  yardages: Record<string, number> | null | undefined,
  teeColor: string | null | undefined
): number | null {
  if (!yardages || !teeColor) return null;
  const value = yardages[teeColor.toLowerCase()];
  return typeof value === "number" && value > 0 ? value : null;
}

function sliceHolesData(
  holesData: CourseHoleData[],
  options: {
    holes: "9" | "18";
    nineSide?: "front" | "back" | null;
  }
): CourseHoleData[] {
  const sorted = [...holesData].sort((a, b) => a.number - b.number);

  if (options.holes === "18") {
    return sorted.slice(0, 18);
  }

  const side = options.nineSide ?? "front";
  return side === "back" && sorted.length >= 18
    ? sorted.slice(9, 18)
    : sorted.slice(0, 9);
}

export function buildMultiTeeHoleSnapshots(
  holesData: CourseHoleData[],
  options: {
    holes: "9" | "18";
    nineSide?: "front" | "back" | null;
  },
  teeColors: readonly string[] = STANDARD_SCORECARD_TEE_COLORS
): ScorecardHoleSnapshot[] {
  return sliceHolesData(holesData, options).map((hole, index) => ({
    holeNumber: index + 1,
    par: hole.par,
    strokeIndex: hole.handicap_index ?? null,
    yardage:
      yardageForTeeColor(hole.yardages, "white") ??
      pickPreferredTeeYardage(hole.yardages),
    yardagesByTee: Object.fromEntries(
      teeColors.map((color) => [
        color,
        yardageForTeeColor(hole.yardages, color),
      ])
    ) as Record<string, number | null>,
  }));
}

export function pickDefaultTeeKey(
  tees: CourseTeeOption[] | undefined
): string | null {
  if (!tees?.length) return null;

  for (const color of DEFAULT_TEE_COLOR_PREFERENCE) {
    const match = tees.find(
      (tee) => tee.tee_color?.toLowerCase() === color && tee.gender !== "Female"
    );
    if (match) return match.tee_key;
  }

  return tees[0]?.tee_key ?? null;
}

export function formatTeeOptionLabel(tee: CourseTeeOption): string {
  const parts = [tee.tee_name];
  if (tee.gender && tee.gender !== "Male") {
    parts[0] = `${tee.tee_name} (${tee.gender})`;
  }
  if (tee.yardage) parts.push(`${tee.yardage.toLocaleString()} yds`);
  if (tee.course_rating != null && tee.slope != null) {
    parts.push(`${tee.course_rating}/${tee.slope}`);
  }
  return parts.join(" · ");
}

function normalizeScorecardFromHolesData(
  holesData: CourseHoleData[],
  teeColor?: string | null
): CourseScorecardHole[] {
  return [...holesData]
    .sort((a, b) => a.number - b.number)
    .map((hole) => ({
      hole: hole.number,
      par: hole.par,
      yardage:
        yardageForTeeColor(hole.yardages, teeColor) ??
        pickPreferredTeeYardage(hole.yardages),
      handicap_index: hole.handicap_index ?? null,
    }));
}

export function buildScorecardForTee(
  course: CourseDetail,
  teeKey: string | null | undefined,
  options: {
    holes: "9" | "18";
    nineSide?: "front" | "back" | null;
  }
): CourseScorecardHole[] {
  const tee = course.tees?.find((entry) => entry.tee_key === teeKey) ?? null;
  const teeColor = tee?.tee_color ?? null;

  let scorecard: CourseScorecardHole[] = [];

  if (course.holes_data?.length) {
    scorecard = normalizeScorecardFromHolesData(course.holes_data, teeColor);
  } else if (course.scorecard?.length) {
    scorecard = [...course.scorecard];
  }

  if (!scorecard.length) return [];

  const sorted = [...scorecard].sort((a, b) => a.hole - b.hole);
  const slice =
    options.holes === "9"
      ? (options.nineSide ?? "front") === "back" && sorted.length >= 18
        ? sorted.slice(9, 18)
        : sorted.slice(0, 9)
      : sorted.slice(0, 18);

  return slice.map((hole, index) => ({
    ...hole,
    hole: index + 1,
  }));
}
