import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

import { getDb } from "@/db";
import {
  golfCourses,
  greenElevationGrids,
  greenTargets,
  holeFeatures,
  mappingRequests,
  type GolfCourse,
  type GreenElevationGrid,
  type GreenTarget,
  type HoleFeature,
  type MappingRequest,
} from "@/db/schema";
import {
  buildGreenTargetsByEventHole,
  eventHoleToCourseHole,
  parseCoordinate,
  type GreenTargets,
  type GreenTargetsByEventHole,
} from "@/lib/green-distance";
import { computeGreenTargets } from "@/lib/green-targets";
import { fetchElevationGridForGreen } from "@/lib/elevation-seed";
import type { CourseMapSeedResult } from "@/lib/course-map-seed";
import {
  assignOsmFeaturesToHoles,
  osmFeatureTypeToHoleFeatureType,
} from "@/lib/hole-spatial-features";
import { fetchOsmGolfFeaturesNear, type OsmGolfFeature } from "@/lib/overpass-golf";
import { unstable_cache } from "next/cache";

type PolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

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
    where: eq(golfCourses.id, courseId),
    with: {
      holeFeatures: {
        orderBy: [asc(holeFeatures.holeNumber)],
      },
      greenTargets: {
        orderBy: [asc(greenTargets.holeNumber)],
      },
      greenElevationGrids: {
        orderBy: [asc(greenElevationGrids.holeNumber)],
      },
    },
  });
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
  const rows = await getDb().query.greenTargets.findMany({
    where: and(
      eq(greenTargets.courseId, courseId),
      eq(greenTargets.holeNumber, holeNumber)
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

  const byCourseHole: Record<number, GreenTargets | null> = {};
  const holeNumbers = [
    ...new Set(
      event.holeNumbers.map((hole) =>
        eventHoleToCourseHole(hole, {
          holes: event.holes,
          nineSide: event.nineSide,
        })
      )
    ),
  ];

  for (const holeNumber of holeNumbers) {
    const holeRows = rows.filter((row) => row.holeNumber === holeNumber);
    byCourseHole[holeNumber] = targetsFromRows(holeRows);
  }

  return buildGreenTargetsByEventHole(event.holeNumbers, event, byCourseHole);
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
    result[eventHole] = await getHoleFeatureCollection(course.id, courseHole);
  }

  return result;
}

export async function getGreenElevationGrid(
  courseId: string,
  holeNumber: number
): Promise<GreenElevationGrid | null> {
  return (
    (await getDb().query.greenElevationGrids.findFirst({
      where: and(
        eq(greenElevationGrids.courseId, courseId),
        eq(greenElevationGrids.holeNumber, holeNumber)
      ),
    })) ?? null
  );
}

export async function getLatestMappingRequestForEvent(eventId: string) {
  return getDb().query.mappingRequests.findFirst({
    where: eq(mappingRequests.eventId, eventId),
    orderBy: [desc(mappingRequests.requestedAt)],
    with: {
      course: {
        with: {
          holeFeatures: true,
          greenTargets: true,
        },
      },
      event: true,
    },
  });
}

export async function getMappingRequestsForOrg(orgId: string) {
  return getDb().query.mappingRequests.findMany({
    where: eq(mappingRequests.orgId, orgId),
    orderBy: [desc(mappingRequests.requestedAt)],
    with: {
      event: true,
      course: true,
    },
  });
}

export async function getMappingRequestForOrg(requestId: string, orgId: string) {
  return getDb().query.mappingRequests.findFirst({
    where: and(eq(mappingRequests.id, requestId), eq(mappingRequests.orgId, orgId)),
    with: {
      event: true,
      course: {
        with: {
          holeFeatures: {
            orderBy: [asc(holeFeatures.holeNumber)],
          },
          greenTargets: {
            orderBy: [asc(greenTargets.holeNumber)],
          },
        },
      },
    },
  });
}

function featureTypeFromOsm(feature: OsmGolfFeature): HoleFeature["featureType"] | null {
  return osmFeatureTypeToHoleFeatureType(feature.featureType);
}

async function upsertHoleFeature(
  db: ReturnType<typeof getDb>,
  values: {
    courseId: string;
    holeNumber: number;
    featureType: HoleFeature["featureType"];
    geometry: unknown;
    osmId: string;
    source: "overpass";
  }
) {
  const existing = await db.query.holeFeatures.findFirst({
    where: and(
      eq(holeFeatures.courseId, values.courseId),
      eq(holeFeatures.osmId, values.osmId)
    ),
  });

  const row = {
    geometry: values.geometry,
    holeNumber: values.holeNumber,
    featureType: values.featureType,
    source: values.source,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(holeFeatures).set(row).where(eq(holeFeatures.id, existing.id));
    return;
  }

  await db.insert(holeFeatures).values({
    courseId: values.courseId,
    osmId: values.osmId,
    ...row,
  });
}

export async function persistSeedResult(
  courseId: string,
  holeNumbers: number[],
  seed: CourseMapSeedResult
) {
  const db = getDb();

  const assigned = assignOsmFeaturesToHoles(seed.allFeatures, holeNumbers);

  for (const [holeNumber, features] of assigned.entries()) {
    for (const feature of features) {
      const featureType = featureTypeFromOsm(feature);
      if (!featureType || !feature.geometry) continue;

      await upsertHoleFeature(db, {
        courseId,
        holeNumber,
        featureType,
        geometry: feature.geometry,
        osmId: feature.osmId,
        source: "overpass",
      });
    }
  }

  for (const holeNumber of holeNumbers) {
    const seededHole = seed.holes[holeNumber];
    if (!seededHole?.geometry || seededHole.geometry === null) continue;

    const existingGreen = await db.query.holeFeatures.findFirst({
      where: and(
        eq(holeFeatures.courseId, courseId),
        eq(holeFeatures.holeNumber, holeNumber),
        eq(holeFeatures.featureType, "green")
      ),
    });

    const manualOsmId = `manual:green:${holeNumber}`;
    const greenValues = {
      geometry: seededHole.geometry,
      osmId: manualOsmId,
      source: seededHole.source === "overpass" ? ("overpass" as const) : ("manual" as const),
      updatedAt: new Date(),
    };

    if (existingGreen) {
      await db
        .update(holeFeatures)
        .set(greenValues)
        .where(eq(holeFeatures.id, existingGreen.id));
    } else {
      await db.insert(holeFeatures).values({
        courseId,
        holeNumber,
        featureType: "green",
        ...greenValues,
      });
    }
  }

  let mappedCount = 0;

  for (const holeNumber of holeNumbers) {
    const greenFeature = await db.query.holeFeatures.findFirst({
      where: and(
        eq(holeFeatures.courseId, courseId),
        eq(holeFeatures.holeNumber, holeNumber),
        eq(holeFeatures.featureType, "green")
      ),
    });

    const holeLine = await db.query.holeFeatures.findFirst({
      where: and(
        eq(holeFeatures.courseId, courseId),
        eq(holeFeatures.holeNumber, holeNumber),
        eq(holeFeatures.featureType, "hole_line")
      ),
    });

    if (!greenFeature?.geometry) continue;

    const targets = computeGreenTargets({
      greenGeometry: greenFeature.geometry as PolygonGeometry,
      holeLineGeometry: (holeLine?.geometry as LineStringGeometry | null) ?? null,
    });

    if (!targets) continue;
    mappedCount += 1;

    for (const [targetType, point] of Object.entries(targets) as [
      "front" | "middle" | "back",
      { lat: number; lng: number },
    ][]) {
      const existing = await db.query.greenTargets.findFirst({
        where: and(
          eq(greenTargets.courseId, courseId),
          eq(greenTargets.holeNumber, holeNumber),
          eq(greenTargets.targetType, targetType)
        ),
      });

      const values = {
        latitude: String(point.lat),
        longitude: String(point.lng),
        computedFrom: "polygon_perimeter" as const,
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(greenTargets).set(values).where(eq(greenTargets.id, existing.id));
      } else {
        await db.insert(greenTargets).values({
          courseId,
          holeNumber,
          targetType,
          ...values,
        });
      }
    }
  }

  await db
    .update(golfCourses)
    .set({
      mappedHoleCount: mappedCount,
      dataQuality: mappedCount > 0 ? "geometry_targets" : "geometry_only",
      updatedAt: new Date(),
    })
    .where(eq(golfCourses.id, courseId));

  return mappedCount;
}

export async function seedElevationForCourse(courseId: string, holeNumbers: number[]) {
  const db = getDb();
  let elevationCount = 0;

  for (const holeNumber of holeNumbers) {
    const greenFeature = await db.query.holeFeatures.findFirst({
      where: and(
        eq(holeFeatures.courseId, courseId),
        eq(holeFeatures.holeNumber, holeNumber),
        eq(holeFeatures.featureType, "green")
      ),
    });

    if (!greenFeature?.geometry) continue;

    const grid = await fetchElevationGridForGreen(
      greenFeature.geometry as PolygonGeometry
    );
    if (!grid) continue;

    elevationCount += 1;

    const existing = await db.query.greenElevationGrids.findFirst({
      where: and(
        eq(greenElevationGrids.courseId, courseId),
        eq(greenElevationGrids.holeNumber, holeNumber)
      ),
    });

    const values = {
      gridWidth: grid.gridWidth,
      gridHeight: grid.gridHeight,
      boundsGeoJson: grid.boundsGeoJson,
      elevationData: grid.elevationData,
      slopeData: grid.slopeData,
      resolutionM: grid.resolutionM,
      source: grid.source,
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(greenElevationGrids)
        .set(values)
        .where(eq(greenElevationGrids.id, existing.id));
    } else {
      await db.insert(greenElevationGrids).values({
        courseId,
        holeNumber,
        ...values,
      });
    }
  }

  if (elevationCount > 0) {
    await db
      .update(golfCourses)
      .set({
        dataQuality: "full",
        updatedAt: new Date(),
      })
      .where(eq(golfCourses.id, courseId));
  }

  return elevationCount;
}

export type MappingRequestWithCourse = MappingRequest & {
  event: { id: string; name: string; slug: string; holes: "9" | "18" };
  course: GolfCourse & {
    holeFeatures: HoleFeature[];
    greenTargets: GreenTarget[];
  };
};

export type CaddieContextForEvent = {
  courseId: string;
  dataQuality: GolfCourse["dataQuality"];
  mappedHoleCount: number;
  greenTargetsByHole: GreenTargetsByEventHole;
  holeFeaturesByHole: Record<
    number,
    Awaited<ReturnType<typeof getHoleFeatureCollection>> | null
  >;
  hasHeatmapByHole: Record<number, boolean>;
};

export async function getCaddieContextForEvent(event: {
  externalCourseId: string | null;
  holes: "9" | "18";
  nineSide?: "front" | "back" | null;
  holeNumbers: number[];
}): Promise<CaddieContextForEvent | null> {
  if (!event.externalCourseId) return null;

  const course = await getPublishedGolfCourseByExternalId(event.externalCourseId);
  if (!course) return null;

  const greenTargetsByHole = await getGreenTargetsForEvent(event);
  if (!greenTargetsByHole) return null;

  const holeFeaturesByHole: CaddieContextForEvent["holeFeaturesByHole"] = {};
  const hasHeatmapByHole: Record<number, boolean> = {};

  const elevationGrids = await getDb().query.greenElevationGrids.findMany({
    where: eq(greenElevationGrids.courseId, course.id),
  });

  for (const eventHole of event.holeNumbers) {
    const courseHole = eventHoleToCourseHole(eventHole, {
      holes: event.holes,
      nineSide: event.nineSide,
    });
    holeFeaturesByHole[eventHole] = await getHoleFeatureCollection(
      course.id,
      courseHole
    );
    hasHeatmapByHole[eventHole] = elevationGrids.some(
      (grid) => grid.holeNumber === courseHole
    );
  }

  return {
    courseId: course.id,
    dataQuality: course.dataQuality,
    mappedHoleCount: course.mappedHoleCount,
    greenTargetsByHole,
    holeFeaturesByHole,
    hasHeatmapByHole,
  };
}
