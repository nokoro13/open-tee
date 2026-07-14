const OPENGOLFAPI_BASE = "https://api.opengolfapi.org/api/v1";

type RawCourseSummary = {
  id: string;
  name?: string;
  course_name?: string;
  city?: string | null;
  state?: string | null;
  par?: number | null;
  par_total?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  website?: string | null;
  type?: string | null;
  course_type?: string | null;
};

type RawCourseDetail = RawCourseSummary & {
  address?: string | null;
  holes?: number | null;
  yardage?: number | null;
  total_yardage?: number | null;
  scorecard?: OpenGolfScorecardHole[];
  holes_data?: OpenGolfHoleData[];
  tees?: OpenGolfTee[];
};

function normalizeCourseSummary(raw: RawCourseSummary): OpenGolfCourseSummary {
  return {
    id: raw.id,
    name: raw.name ?? raw.course_name ?? "",
    course_name: raw.course_name ?? raw.name,
    city: raw.city ?? null,
    state: raw.state ?? null,
    par: raw.par ?? raw.par_total ?? null,
    latitude: raw.latitude ?? raw.lat ?? null,
    longitude: raw.longitude ?? raw.lng ?? null,
    phone: raw.phone ?? null,
    website: raw.website ?? null,
    type: raw.type ?? raw.course_type ?? null,
  };
}

function normalizeCourseDetail(
  raw: RawCourseDetail,
  teeColor?: string | null
): OpenGolfCourseDetail {
  const summary = normalizeCourseSummary(raw);
  const holesData = raw.holes_data ?? [];
  const scorecardFromHoles =
    holesData.length > 0
      ? normalizeScorecardFromHolesData(holesData, teeColor)
      : null;

  const latitude = summary.latitude;
  const longitude = summary.longitude;

  return {
    ...summary,
    address: raw.address ?? null,
    holes: typeof raw.holes === "number" ? raw.holes : null,
    yardage: raw.yardage ?? raw.total_yardage ?? null,
    scorecard: scorecardFromHoles ?? raw.scorecard,
    holes_data: holesData.length > 0 ? holesData : raw.holes_data,
    tees: raw.tees,
    lat: latitude,
    lng: longitude,
  };
}

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
  lat?: number | null;
  lng?: number | null;
};

type SearchResponse = {
  courses: OpenGolfCourseSummary[];
  total: number;
};

export function extractOpenGolfCourseCoordinates(
  course: OpenGolfCourseDetail | null | undefined
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
  holesData: OpenGolfHoleData[],
  options: {
    holes: "9" | "18";
    nineSide?: "front" | "back" | null;
  }
): OpenGolfHoleData[] {
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
  holesData: OpenGolfHoleData[],
  options: {
    holes: "9" | "18";
    nineSide?: "front" | "back" | null;
  },
  teeColors: readonly string[] = STANDARD_SCORECARD_TEE_COLORS
) {
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
  return (data.courses ?? []).map((course) =>
    normalizeCourseSummary(course as RawCourseSummary)
  );
}

export async function getOpenGolfCourse(
  courseId: string,
  options?: { teeKey?: string | null }
): Promise<OpenGolfCourseDetail | null> {
  const response = await fetch(`${OPENGOLFAPI_BASE}/courses/${courseId}`, {
    next: { revalidate: 86400 },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Could not load course details.");
  }

  const raw = (await response.json()) as RawCourseDetail;
  const teeKey =
    options?.teeKey ?? pickDefaultTeeKey(raw.tees) ?? null;
  const tee = raw.tees?.find((entry) => entry.tee_key === teeKey);
  const teeColor = tee?.tee_color ?? null;

  return normalizeCourseDetail(raw, teeColor);
}

type OpenGolfFeature = {
  id: string;
  center?: { lat: number; lng: number } | null;
  geometry?: { type: string; coordinates: unknown };
};

type OpenGolfFeaturesResponse = {
  features?: OpenGolfFeature[];
};

export type OpenGolfGreenFeatureSeed = {
  center: { lat: number; lng: number } | null;
  geometry: OpenGolfFeature["geometry"] | null;
};

export async function getGreenFeatureForCourseHole(
  courseId: string,
  holeNumber: number
): Promise<OpenGolfGreenFeatureSeed | null> {
  const url = new URL(`${OPENGOLFAPI_BASE}/features`);
  url.searchParams.set("course", courseId);
  url.searchParams.set("hole", String(holeNumber));
  url.searchParams.set("type", "green");

  const response = await fetch(url.toString(), {
    next: { revalidate: 86400 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as OpenGolfFeaturesResponse;
  const feature = data.features?.[0];
  if (!feature) return null;

  const center = feature.center;
  const hasCenter =
    center &&
    typeof center.lat === "number" &&
    typeof center.lng === "number";

  return {
    center: hasCenter ? { lat: center.lat, lng: center.lng } : null,
    geometry: feature.geometry ?? null,
  };
}

export async function seedGreenFeaturesForCourse(
  courseId: string,
  holeNumbers: number[]
): Promise<
  Record<
    number,
    { center: { lat: number; lng: number } | null; geometry: unknown | null }
  >
> {
  const entries = await Promise.all(
    holeNumbers.map(async (holeNumber) => {
      const feature = await getGreenFeatureForCourseHole(courseId, holeNumber);
      return [
        holeNumber,
        {
          center: feature?.center ?? null,
          geometry: feature?.geometry ?? null,
        },
      ] as const;
    })
  );

  return Object.fromEntries(entries);
}
