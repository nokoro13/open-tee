const OPENGOLFAPI_BASE = "https://api.opengolfapi.org/v1";
const OPENGOLFAPI_V1_BASE = "https://api.opengolfapi.org/api/v1";

export type OpenGolfCourseSummary = {
  id: string;
  name: string;
  course_name?: string;
  city?: string | null;
  state?: string | null;
  par?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  website?: string | null;
  type?: string | null;
};

export type OpenGolfScorecardHole = {
  hole: number;
  par: number;
  yardage?: number | null;
  handicap_index?: number | null;
};

export type OpenGolfHoleData = {
  number: number;
  par: number;
  handicap_index?: number | null;
  yardages?: Record<string, number> | null;
};

export type OpenGolfTee = {
  tee_key: string;
  tee_name: string;
  tee_color?: string | null;
  gender?: string | null;
  course_rating?: number | null;
  slope?: number | null;
  par?: number | null;
  yardage?: number | null;
};

export type OpenGolfCourseDetail = OpenGolfCourseSummary & {
  address?: string | null;
  holes?: number | null;
  yardage?: number | null;
  scorecard?: OpenGolfScorecardHole[];
  holes_data?: OpenGolfHoleData[];
  tees?: OpenGolfTee[];
};

type SearchResponse = {
  courses: OpenGolfCourseSummary[];
  total: number;
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

function yardageForTeeColor(
  yardages: Record<string, number> | null | undefined,
  teeColor: string | null | undefined
): number | null {
  if (!yardages || !teeColor) return null;
  const value = yardages[teeColor.toLowerCase()];
  return typeof value === "number" && value > 0 ? value : null;
}

export function pickDefaultTeeKey(tees: OpenGolfTee[] | undefined): string | null {
  if (!tees?.length) return null;

  for (const color of DEFAULT_TEE_COLOR_PREFERENCE) {
    const match = tees.find(
      (tee) => tee.tee_color?.toLowerCase() === color && tee.gender !== "Female"
    );
    if (match) return match.tee_key;
  }

  return tees[0]?.tee_key ?? null;
}

export function formatTeeOptionLabel(tee: OpenGolfTee): string {
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
  holesData: OpenGolfHoleData[],
  teeColor?: string | null
): OpenGolfScorecardHole[] {
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

function mergeCourseDetail(
  basic: OpenGolfCourseDetail,
  full: OpenGolfCourseDetail | null,
  teeColor?: string | null
): OpenGolfCourseDetail {
  if (!full) return basic;

  const holesData = full.holes_data ?? [];
  const scorecardFromHoles =
    holesData.length > 0 ? normalizeScorecardFromHolesData(holesData, teeColor) : null;

  return {
    ...basic,
    ...full,
    name: basic.name || full.name,
    city: basic.city ?? full.city,
    state: basic.state ?? full.state,
    scorecard: scorecardFromHoles ?? basic.scorecard ?? full.scorecard,
    holes_data: holesData.length > 0 ? holesData : full.holes_data,
    tees: full.tees ?? basic.tees,
  };
}

export function buildScorecardForTee(
  course: OpenGolfCourseDetail,
  teeKey: string | null | undefined,
  options: {
    holes: "9" | "18";
    nineSide?: "front" | "back" | null;
  }
): OpenGolfScorecardHole[] {
  const tee = course.tees?.find((entry) => entry.tee_key === teeKey) ?? null;
  const teeColor = tee?.tee_color ?? null;

  let scorecard: OpenGolfScorecardHole[] = [];

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

export async function searchOpenGolfCourses(
  query: string,
  limit = 8
): Promise<OpenGolfCourseSummary[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL(`${OPENGOLFAPI_BASE}/courses/search`);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error("Course search failed.");
  }

  const data = (await response.json()) as SearchResponse;
  return data.courses ?? [];
}

async function getOpenGolfCourseBasic(
  courseId: string
): Promise<OpenGolfCourseDetail | null> {
  const response = await fetch(`${OPENGOLFAPI_BASE}/courses/${courseId}`, {
    next: { revalidate: 86400 },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Could not load course details.");
  }

  return (await response.json()) as OpenGolfCourseDetail;
}

async function getOpenGolfCourseFull(
  courseId: string
): Promise<OpenGolfCourseDetail | null> {
  const response = await fetch(`${OPENGOLFAPI_V1_BASE}/courses/${courseId}`, {
    next: { revalidate: 86400 },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as OpenGolfCourseDetail;
}

export async function getOpenGolfCourse(
  courseId: string,
  options?: { teeKey?: string | null }
): Promise<OpenGolfCourseDetail | null> {
  const [basic, full] = await Promise.all([
    getOpenGolfCourseBasic(courseId),
    getOpenGolfCourseFull(courseId),
  ]);

  if (!basic && !full) return null;

  const teeKey =
    options?.teeKey ??
    pickDefaultTeeKey(full?.tees ?? basic?.tees) ??
    null;
  const tee = full?.tees?.find((entry) => entry.tee_key === teeKey);
  const teeColor = tee?.tee_color ?? null;

  if (!basic) return full;
  return mergeCourseDetail(basic, full, teeColor);
}
