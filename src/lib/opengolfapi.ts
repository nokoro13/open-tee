const OPENGOLFAPI_BASE = "https://api.opengolfapi.org/v1";
const OPENGOLFAPI_V1_BASE = "https://api.opengolfapi.org/api/v1";

export type OpenGolfCourseSummary = {
  id: string;
  name: string;
  course_name?: string;
  city?: string | null;
  state?: string | null;
  par?: number | null;
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

export type OpenGolfCourseDetail = OpenGolfCourseSummary & {
  address?: string | null;
  holes?: number | null;
  scorecard?: OpenGolfScorecardHole[];
  holes_data?: OpenGolfHoleData[];
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

function normalizeScorecardFromHolesData(
  holesData: OpenGolfHoleData[]
): OpenGolfScorecardHole[] {
  return [...holesData]
    .sort((a, b) => a.number - b.number)
    .map((hole) => ({
      hole: hole.number,
      par: hole.par,
      yardage: pickPreferredTeeYardage(hole.yardages),
      handicap_index: hole.handicap_index ?? null,
    }));
}

function mergeCourseDetail(
  basic: OpenGolfCourseDetail,
  full: OpenGolfCourseDetail | null
): OpenGolfCourseDetail {
  if (!full) return basic;

  const holesData = full.holes_data ?? [];
  const scorecardFromHoles =
    holesData.length > 0 ? normalizeScorecardFromHolesData(holesData) : null;

  return {
    ...basic,
    ...full,
    name: basic.name || full.name,
    scorecard: scorecardFromHoles ?? basic.scorecard ?? full.scorecard,
    holes_data: holesData.length > 0 ? holesData : full.holes_data,
  };
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
  courseId: string
): Promise<OpenGolfCourseDetail | null> {
  const [basic, full] = await Promise.all([
    getOpenGolfCourseBasic(courseId),
    getOpenGolfCourseFull(courseId),
  ]);

  if (!basic && !full) return null;
  if (!basic) return full;
  return mergeCourseDetail(basic, full);
}
