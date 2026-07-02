const OPENGOLFAPI_BASE = "https://api.opengolfapi.org/v1";

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
};

export type OpenGolfCourseDetail = OpenGolfCourseSummary & {
  address?: string | null;
  holes?: number | null;
  scorecard?: OpenGolfScorecardHole[];
};

type SearchResponse = {
  courses: OpenGolfCourseSummary[];
  total: number;
};

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

export async function getOpenGolfCourse(
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
