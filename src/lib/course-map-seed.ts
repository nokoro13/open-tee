import { isLocalCourseId } from "@/lib/local-course";
import {
  assignGreensToHoles,
  fetchOsmGolfFeaturesNear,
  type OsmGolfFeature,
} from "@/lib/overpass-golf";
import { seedGreenFeaturesForCourse } from "@/lib/opengolfapi";

export type SeedHoleFeature = {
  center: { lat: number; lng: number } | null;
  geometry: unknown | null;
  source: "overpass" | "opengolf" | null;
};

export type CourseMapSeedMeta = {
  overpassGreenCount: number;
  opengolfHoleCount: number;
  assignedHoleCount: number;
  unassignedGreens: { osmId: string; label: string; lat: number; lng: number }[];
  usedOverpass: boolean;
  usedOpenGolf: boolean;
  seedLatitude: number | null;
  seedLongitude: number | null;
  overpassError: string | null;
};

export type CourseMapSeedResult = {
  holes: Record<number, SeedHoleFeature>;
  allFeatures: OsmGolfFeature[];
  meta: CourseMapSeedMeta;
};

async function seedFromOverpass(
  latitude: number,
  longitude: number,
  holeNumbers: number[]
): Promise<{
  holes: Record<number, SeedHoleFeature>;
  allFeatures: OsmGolfFeature[];
  unassignedGreens: OsmGolfFeature[];
  greenCount: number;
}> {
  const allFeatures = await fetchOsmGolfFeaturesNear(latitude, longitude);
  const greens = allFeatures.filter((feature) => feature.featureType === "green");
  const assignment = assignGreensToHoles(allFeatures, holeNumbers);

  const holes: Record<number, SeedHoleFeature> = {};
  for (const holeNumber of holeNumbers) {
    const assigned = assignment.byHole[holeNumber];
    holes[holeNumber] = assigned
      ? {
          center: assigned.center,
          geometry: assigned.geometry,
          source: "overpass",
        }
      : { center: null, geometry: null, source: null };
  }

  return {
    holes,
    allFeatures,
    unassignedGreens: assignment.unassignedGreens,
    greenCount: greens.length,
  };
}

async function seedFromOpenGolf(
  externalCourseId: string,
  holeNumbers: number[]
): Promise<Record<number, SeedHoleFeature>> {
  const raw = await seedGreenFeaturesForCourse(externalCourseId, holeNumbers);
  const holes: Record<number, SeedHoleFeature> = {};

  for (const holeNumber of holeNumbers) {
    const feature = raw[holeNumber];
    holes[holeNumber] = feature?.center
      ? {
          center: feature.center,
          geometry: feature.geometry ?? null,
          source: "opengolf",
        }
      : { center: null, geometry: null, source: null };
  }

  return holes;
}

export async function seedCourseMapHoles(options: {
  externalCourseId: string | null;
  courseHoleNumbers: number[];
  courseLatitude: number | null;
  courseLongitude: number | null;
}): Promise<CourseMapSeedResult> {
  const { externalCourseId, courseHoleNumbers, courseLatitude, courseLongitude } =
    options;

  let overpassHoles: Record<number, SeedHoleFeature> = {};
  let allFeatures: OsmGolfFeature[] = [];
  let unassignedGreens: OsmGolfFeature[] = [];
  let overpassGreenCount = 0;
  let usedOverpass = false;
  let overpassError: string | null = null;

  if (courseLatitude != null && courseLongitude != null) {
    try {
      const overpass = await seedFromOverpass(
        courseLatitude,
        courseLongitude,
        courseHoleNumbers
      );
      overpassHoles = overpass.holes;
      allFeatures = overpass.allFeatures;
      unassignedGreens = overpass.unassignedGreens;
      overpassGreenCount = overpass.greenCount;
      usedOverpass = overpassGreenCount > 0;
    } catch (error) {
      overpassError =
        error instanceof Error ? error.message : "Overpass request failed.";
    }
  } else {
    overpassError = "Course coordinates missing — cannot query OpenStreetMap.";
  }

  let opengolfHoles: Record<number, SeedHoleFeature> = {};
  let opengolfHoleCount = 0;
  let usedOpenGolf = false;

  if (externalCourseId && !isLocalCourseId(externalCourseId)) {
    try {
      opengolfHoles = await seedFromOpenGolf(externalCourseId, courseHoleNumbers);
      opengolfHoleCount = Object.values(opengolfHoles).filter(
        (hole) => hole.center != null
      ).length;
      usedOpenGolf = opengolfHoleCount > 0;
    } catch {
      // OpenGolf per-hole features may be empty for this course.
    }
  }

  const merged: Record<number, SeedHoleFeature> = {};
  for (const holeNumber of courseHoleNumbers) {
    const overpass = overpassHoles[holeNumber];
    const opengolf = opengolfHoles[holeNumber];

    if (overpass?.center) {
      merged[holeNumber] = overpass;
    } else if (opengolf?.center) {
      merged[holeNumber] = opengolf;
    } else {
      merged[holeNumber] = { center: null, geometry: null, source: null };
    }
  }

  const assignedHoleCount = Object.values(merged).filter(
    (hole) => hole.center != null
  ).length;

  return {
    holes: merged,
    allFeatures,
    meta: {
      overpassGreenCount,
      opengolfHoleCount,
      assignedHoleCount,
      unassignedGreens: unassignedGreens.map((green) => ({
        osmId: green.osmId,
        label: `${green.osmId} (${green.center.lat.toFixed(5)}, ${green.center.lng.toFixed(5)})`,
        lat: green.center.lat,
        lng: green.center.lng,
      })),
      usedOverpass,
      usedOpenGolf,
      seedLatitude: courseLatitude,
      seedLongitude: courseLongitude,
      overpassError,
    },
  };
}
