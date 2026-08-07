import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

import { getDb } from "@/db";
import {
  courseTees,
  golfCourses,
  greenTargets,
  holeFeatures,
  type GolfCourse,
  type GreenTarget,
  type HoleFeature,
} from "@/db/schema";
import { sortCourseTees, teeMarkerColor } from "@/lib/course-tees";
import {
  buildGreenTargetsByEventHole,
  courseHoleToPhysicalHole,
  eventHoleToCourseHole,
  parseCoordinate,
  type GreenTargets,
  type GreenTargetsByEventHole,
} from "@/lib/green-distance";
import {
  assignOsmFeaturesToHoles,
  osmFeatureTypeToHoleFeatureType,
} from "@/lib/hole-spatial-features";
import { fetchOsmGolfFeaturesNear, type OsmGolfFeature } from "@/lib/overpass-golf";
import { unstable_cache } from "next/cache";

function latLngFromTarget(target: GreenTarget) {
  const lat = parseCoordinate(target.latitude);
  const lng = parseCoordinate(target.longitude);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function targetsFromRows(rows: GreenTarget[]): GreenTargets | null {
  const front = rows.find((row) => row.targetType === "front");
  const middle = rows.find((row) => row.targetType === "middle");
  const back = rows.find((row) => row.targetType === "back");
  if (!front || !middle || !back) return null;

  const frontPoint = latLngFromTarget(front);
  const middlePoint = latLngFromTarget(middle);
  const backPoint = latLngFromTarget(back);
  if (!frontPoint || !middlePoint || !backPoint) return null;

  return { front: frontPoint, middle: middlePoint, back: backPoint };
}

export async function getGolfCourseByExternalId(
  externalCourseId: string
): Promise<GolfCourse | null> {
  return (
    (await getDb().query.golfCourses.findFirst({
      where: eq(golfCourses.externalCourseId, externalCourseId),
    })) ?? null
  );
}

export async function getPublishedGolfCourseByExternalId(
  externalCourseId: string
): Promise<GolfCourse | null> {
  return (
    (await getDb().query.golfCourses.findFirst({
      where: and(
        eq(golfCourses.externalCourseId, externalCourseId),
        eq(golfCourses.status, "published")
      ),
    })) ?? null
  );
}

export async function searchGolfCourses(query: string, limit = 8) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return getDb().query.golfCourses.findMany({
    where: or(
      ilike(golfCourses.name, `%${trimmed}%`),
      ilike(golfCourses.city, `%${trimmed}%`)
    ),
    orderBy: [desc(golfCourses.publishedAt), asc(golfCourses.name)],
    limit,
  });
}

export async function getGolfCourseWithDetails(courseId: string) {
  return getDb().query.golfCourses.findFirst({
    where: or(
      eq(golfCourses.id, courseId),
      eq(golfCourses.externalCourseId, courseId)
    ),
    with: {
      holeFeatures: {
        orderBy: [asc(holeFeatures.holeNumber)],
      },
      greenTargets: {
        orderBy: [asc(greenTargets.holeNumber)],
      },
    },
  });
}

async function getCourseForGeometryLookup(courseId: string) {
  return (
    (await getDb().query.golfCourses.findFirst({
      where: eq(golfCourses.id, courseId),
    })) ??
    (await getDb().query.golfCourses.findFirst({
      where: eq(golfCourses.externalCourseId, courseId),
    })) ??
    null
  );
}

export async function resolvePhysicalCourseHole(
  courseId: string,
  courseHole: number
): Promise<number> {
  const resolved = await resolveCourseHoleGeometry(courseId, courseHole);
  return resolved?.physicalHole ?? courseHole;
}

export async function resolveCourseHoleGeometry(
  courseKey: string,
  courseHole: number
): Promise<{ courseId: string; physicalHole: number } | null> {
  const course = await getCourseForGeometryLookup(courseKey);
  if (!course) return null;
  return {
    courseId: course.id,
    physicalHole: courseHoleToPhysicalHole(courseHole, course),
  };
}

export async function getHoleFeatureCollection(
  courseId: string,
  holeNumber: number
) {
  const features = await getDb().query.holeFeatures.findMany({
    where: and(
      eq(holeFeatures.courseId, courseId),
      eq(holeFeatures.holeNumber, holeNumber)
    ),
  });

  return toFeatureCollection(features);
}

function toFeatureCollection(
  features: Array<{
    featureType: HoleFeature["featureType"];
    osmId: string | null;
    source: HoleFeature["source"];
    geometry: unknown;
  }>
) {
  return {
    type: "FeatureCollection" as const,
    features: features.map((feature) => ({
      type: "Feature" as const,
      properties: {
        featureType: feature.featureType,
        osmId: feature.osmId,
        source: feature.source,
      },
      geometry: feature.geometry,
    })),
  };
}

async function loadCachedOsmFeatures(courseId: string, lat: number, lng: number) {
  return unstable_cache(
    () => fetchOsmGolfFeaturesNear(lat, lng),
    ["course-osm-features", courseId],
    { revalidate: 60 * 60 * 24 }
  )();
}

export async function getEnrichedHoleFeatureCollection(
  courseId: string,
  holeNumber: number
) {
  const db = getDb();
  const course = await db.query.golfCourses.findFirst({
    where: eq(golfCourses.id, courseId),
  });

  const dbFeatures = await db.query.holeFeatures.findMany({
    where: eq(holeFeatures.courseId, courseId),
  });
  const dbCollection = toFeatureCollection(
    dbFeatures.filter((feature) => feature.holeNumber === holeNumber)
  );

  const lat = parseCoordinate(course?.latitude);
  const lng = parseCoordinate(course?.longitude);
  if (lat == null || lng == null) return dbCollection;

  const holeNumbers = [
    ...new Set(dbFeatures.map((feature) => feature.holeNumber)),
  ];
  if (!holeNumbers.includes(holeNumber)) {
    holeNumbers.push(holeNumber);
  }

  let osmFeatures: OsmGolfFeature[];
  try {
    osmFeatures = await loadCachedOsmFeatures(courseId, lat, lng);
  } catch {
    return dbCollection;
  }

  const assigned = assignOsmFeaturesToHoles(
    osmFeatures,
    holeNumbers.sort((left, right) => left - right)
  );
  const spatialFeatures = assigned.get(holeNumber) ?? [];
  const existingOsmIds = new Set(
    dbFeatures
      .filter((feature) => feature.holeNumber === holeNumber)
      .map((feature) => feature.osmId)
      .filter((osmId): osmId is string => osmId != null)
  );

  const mergedFeatures = [...dbCollection.features];
  for (const feature of spatialFeatures) {
    if (existingOsmIds.has(feature.osmId)) continue;

    const featureType = osmFeatureTypeToHoleFeatureType(feature.featureType);
    if (!featureType || !feature.geometry) continue;

    mergedFeatures.push({
      type: "Feature" as const,
      properties: {
        featureType,
        osmId: feature.osmId,
        source: "overpass",
      },
      geometry: feature.geometry,
    });
  }

  return {
    type: "FeatureCollection" as const,
    features: mergedFeatures,
  };
}

export async function getHoleTargets(
  courseId: string,
  holeNumber: number
): Promise<GreenTargets | null> {
  const resolved = await resolveCourseHoleGeometry(courseId, holeNumber);
  if (!resolved) return null;

  const rows = await getDb().query.greenTargets.findMany({
    where: and(
      eq(greenTargets.courseId, resolved.courseId),
      eq(greenTargets.holeNumber, resolved.physicalHole)
    ),
  });

  return targetsFromRows(rows);
}

export async function getGreenTargetsForEvent(event: {
  externalCourseId: string | null;
  holes: "9" | "18";
  nineSide?: "front" | "back" | null;
  holeNumbers: number[];
}): Promise<GreenTargetsByEventHole | null> {
  if (!event.externalCourseId) return null;

  const course = await getPublishedGolfCourseByExternalId(event.externalCourseId);
  if (!course) return null;

  const rows = await getDb().query.greenTargets.findMany({
    where: eq(greenTargets.courseId, course.id),
  });

  const byPhysicalHole: Record<number, GreenTargets | null> = {};
  const physicalHoles = [
    ...new Set(
      event.holeNumbers.map((hole) => {
        const courseHole = eventHoleToCourseHole(hole, {
          holes: event.holes,
          nineSide: event.nineSide,
        });
        return courseHoleToPhysicalHole(courseHole, course);
      })
    ),
  ];

  for (const physicalHole of physicalHoles) {
    const holeRows = rows.filter((row) => row.holeNumber === physicalHole);
    byPhysicalHole[physicalHole] = targetsFromRows(holeRows);
  }

  return buildGreenTargetsByEventHole(
    event.holeNumbers,
    event,
    byPhysicalHole,
    course
  );
}

export async function getHoleFeaturesForEvent(event: {
  externalCourseId: string | null;
  holes: "9" | "18";
  nineSide?: "front" | "back" | null;
  holeNumbers: number[];
}) {
  if (!event.externalCourseId) return null;

  const course = await getPublishedGolfCourseByExternalId(event.externalCourseId);
  if (!course) return null;

  const result: Record<number, Awaited<ReturnType<typeof getHoleFeatureCollection>> | null> =
    {};

  for (const eventHole of event.holeNumbers) {
    const courseHole = eventHoleToCourseHole(eventHole, {
      holes: event.holes,
      nineSide: event.nineSide,
    });
    const physicalHole = courseHoleToPhysicalHole(courseHole, course);
    result[eventHole] = await getHoleFeatureCollection(course.id, physicalHole);
  }

  return result;
}

export type CaddieContextForEvent = {
  courseId: string;
  dataQuality: GolfCourse["dataQuality"];
  mappedHoleCount: number;
  greenTargetsByHole: GreenTargetsByEventHole;
  holeFeaturesByHole: Record<
    number,
    Awaited<ReturnType<typeof getHoleFeatureCollection>> | null
  >;
  selectedTeeColor: string | null;
};

export async function getCaddieContextForEvent(event: {
  externalCourseId: string | null;
  selectedTeeKey?: string | null;
  holes: "9" | "18";
  nineSide?: "front" | "back" | null;
  holeNumbers: number[];
}): Promise<CaddieContextForEvent | null> {
  if (!event.externalCourseId) return null;

  const course = await getPublishedGolfCourseByExternalId(event.externalCourseId);
  if (!course) return null;

  const [greenTargetsByHole, courseTeeRows, holeFeatureEntries] =
    await Promise.all([
      getGreenTargetsForEvent(event),
      getDb().query.courseTees.findMany({
        where: eq(courseTees.courseId, course.id),
        orderBy: [asc(courseTees.sortOrder), asc(courseTees.teeName)],
      }),
      Promise.all(
        event.holeNumbers.map(async (eventHole) => {
          const courseHole = eventHoleToCourseHole(eventHole, {
            holes: event.holes,
            nineSide: event.nineSide,
          });
          const physicalHole = courseHoleToPhysicalHole(courseHole, course);
          const features = await getHoleFeatureCollection(
            course.id,
            physicalHole
          );
          return [eventHole, features] as const;
        })
      ),
    ]);

  if (!greenTargetsByHole) return null;

  const holeFeaturesByHole = Object.fromEntries(
    holeFeatureEntries
  ) as CaddieContextForEvent["holeFeaturesByHole"];

  const sortedCourseTees = sortCourseTees(courseTeeRows);
  const selectedTee =
    sortedCourseTees.find((tee) => tee.teeKey === event.selectedTeeKey) ??
    sortedCourseTees[0] ??
    null;
  const selectedTeeColor = selectedTee ? teeMarkerColor(selectedTee) : null;

  return {
    courseId: course.id,
    dataQuality: course.dataQuality,
    mappedHoleCount: course.mappedHoleCount,
    greenTargetsByHole,
    holeFeaturesByHole,
    selectedTeeColor,
  };
}
