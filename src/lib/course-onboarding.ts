import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

import { getDb } from "@/db";
import {
  courseHoles,
  courseTees,
  golfCourses,
  greenTargets,
  holeFeatures,
  type CourseHole,
  type CourseTee,
  type GolfCourse,
} from "@/db/schema";
import {
  manualHoleLineOsmId,
  manualTeeOsmId,
  parseManualHoleLineOsmId,
  parseManualTeeOsmId,
  sortCourseTees,
  totalYardageForTee,
  type CourseTeeInput,
} from "@/lib/course-tees";
import {
  midpoint,
  resolveInitialBreakPoint,
} from "@/lib/hole-distance-guide";
import { computeGreenTargets } from "@/lib/green-targets";
import type { LatLng } from "@/lib/green-distance";
import { parseCoordinate, yardsBetween } from "@/lib/green-distance";
import type { ScorecardHoleSnapshot } from "@/lib/scorecard";
import {
  type CourseDetail,
} from "@/lib/course-catalog";
import {
  normalizeCourseMatchText,
  parseCourseCountry,
  type CourseCountry,
} from "@/lib/course-location";

export type CourseOnboardingStep = "details" | "scorecard" | "mapping" | "review";

export type CourseHolePin = {
  holeNumber: number;
  green: LatLng | null;
  tees: Record<string, LatLng>;
  lineBreak: LatLng | null;
};

export type CourseMappingProgress = {
  mappedHoleCount: number;
  mappedTeeCount: number;
  requiredTeeCount: number;
  isComplete: boolean;
};

export function countCourseMappingProgress(
  course: Pick<GolfCourse, "holeCount">,
  courseTees: Pick<CourseTee, "teeKey">[],
  greenTargets: { holeNumber: number; targetType: string }[],
  holeFeatures: { osmId: string | null; featureType: string }[]
): CourseMappingProgress {
  const teeKeys = courseTees.map((tee) => tee.teeKey);
  const requiredTeeCount = course.holeCount * teeKeys.length;

  const mappedHoleCount = new Set(
    greenTargets
      .filter((target) => target.targetType === "middle")
      .map((target) => target.holeNumber)
  ).size;

  const mappedTeeKeys = new Set<string>();
  for (const feature of holeFeatures) {
    if (feature.featureType !== "tee") continue;
    const parsed = parseManualTeeOsmId(feature.osmId);
    if (!parsed || !teeKeys.includes(parsed.teeKey)) continue;
    mappedTeeKeys.add(`${parsed.holeNumber}:${parsed.teeKey}`);
  }

  const mappedTeeCount = mappedTeeKeys.size;
  const isComplete =
    mappedHoleCount >= course.holeCount &&
    (teeKeys.length === 0 || mappedTeeCount >= requiredTeeCount);

  return {
    mappedHoleCount,
    mappedTeeCount,
    requiredTeeCount,
    isComplete,
  };
}

export function onboardingStepForCourse(
  course: Pick<
    GolfCourse,
    "name" | "latitude" | "longitude" | "holeCount" | "scorecardImageUrl" | "onboardingStatus"
  >,
  holes: CourseHole[],
  courseTees: Pick<CourseTee, "teeKey">[],
  mappingProgress: CourseMappingProgress
): CourseOnboardingStep {
  if (
    course.onboardingStatus === "submitted" ||
    course.onboardingStatus === "verified" ||
    course.onboardingStatus === "rejected"
  ) {
    return "review";
  }

  const hasDetails =
    course.name.trim().length > 0 &&
    course.latitude != null &&
    course.longitude != null;

  if (!hasDetails) return "details";

  const hasScorecard =
    courseTees.length > 0 &&
    holes.length === course.holeCount &&
    holes.every((hole) => hole.par >= 3 && hole.par <= 5) &&
    holes.every((hole) =>
      courseTees.every((tee) => {
        const yardage = hole.teeYardages?.[tee.teeKey] ?? hole.yardage;
        return yardage != null && yardage > 0;
      })
    );

  if (!hasScorecard) return "scorecard";

  if (!mappingProgress.isComplete) return "mapping";

  return "review";
}

export function holeNumbersForCount(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function metersToLatOffset(meters: number): number {
  return meters / 111_320;
}

function metersToLngOffset(meters: number, latitude: number): number {
  return meters / (111_320 * Math.cos((latitude * Math.PI) / 180));
}

export function greenPolygonAroundPoint(center: LatLng, radiusMeters = 12) {
  const points: [number, number][] = [];
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const lat =
      center.lat + metersToLatOffset(Math.sin(angle) * radiusMeters);
    const lng =
      center.lng +
      metersToLngOffset(Math.cos(angle) * radiusMeters, center.lat);
    points.push([lng, lat]);
  }
  points.push(points[0]);
  return {
    type: "Polygon" as const,
    coordinates: [points],
  };
}

export function pointGeometry(point: LatLng) {
  return {
    type: "Point" as const,
    coordinates: [point.lng, point.lat] as [number, number],
  };
}

export function holeLineGeometry(tee: LatLng, green: LatLng) {
  return holeLinePathGeometry([tee, green]);
}

export function holeLinePathGeometry(points: LatLng[]) {
  return {
    type: "LineString" as const,
    coordinates: points.map(
      (point) => [point.lng, point.lat] as [number, number]
    ),
  };
}

export function lineStringToPath(geometry: unknown): LatLng[] {
  const line = geometry as {
    type?: string;
    coordinates?: [number, number][];
  };
  if (line.type !== "LineString" || !line.coordinates) return [];
  return line.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

export function breakPointFromLinePath(
  path: LatLng[],
  from: LatLng,
  to: LatLng
): LatLng | null {
  if (path.length >= 3) {
    return resolveInitialBreakPoint(path, from, to);
  }
  return null;
}

export function manualTargetsFromPins(tee: LatLng, green: LatLng) {
  const polygon = greenPolygonAroundPoint(green);
  return computeGreenTargets({
    greenGeometry: polygon,
    holeLineGeometry: holeLineGeometry(tee, green),
  });
}

export function courseHolesToScorecardSnapshots(
  holes: CourseHole[],
  defaultTeeKey?: string | null
): ScorecardHoleSnapshot[] {
  return holes.map((hole) => {
    const yardagesByTee = hole.teeYardages ?? undefined;
    const yardage =
      (defaultTeeKey ? yardagesByTee?.[defaultTeeKey] : null) ??
      hole.yardage ??
      (yardagesByTee ? Object.values(yardagesByTee)[0] : null);

    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      yardage,
      strokeIndex: hole.strokeIndex,
      yardagesByTee,
    };
  });
}

export async function getCourseOnboardingBundle(courseId: string) {
  return getDb().query.golfCourses.findFirst({
    where: eq(golfCourses.id, courseId),
    with: {
      courseTees: {
        orderBy: [asc(courseTees.sortOrder), asc(courseTees.teeName)],
      },
      courseHoles: {
        orderBy: [asc(courseHoles.holeNumber)],
      },
      holeFeatures: {
        orderBy: [asc(holeFeatures.holeNumber)],
      },
      greenTargets: {
        orderBy: [asc(greenTargets.holeNumber)],
      },
    },
  });
}

export function extractHolePinsFromFeatures(
  features: {
    holeNumber: number;
    featureType: string;
    geometry: unknown;
    osmId?: string | null;
  }[]
): Record<number, CourseHolePin> {
  const pins: Record<number, CourseHolePin> = {};

  for (const feature of features) {
    const geometry = feature.geometry as {
      type?: string;
      coordinates?: unknown;
    } | null;
    if (!geometry) continue;

    if (!pins[feature.holeNumber]) {
      pins[feature.holeNumber] = {
        holeNumber: feature.holeNumber,
        green: null,
        tees: {},
        lineBreak: null,
      };
    }

    if (feature.featureType === "hole_line" && geometry.type === "LineString") {
      const path = lineStringToPath(geometry);
      if (path.length < 2) continue;
      const breakPoint = breakPointFromLinePath(
        path,
        path[0]!,
        path[path.length - 1]!
      );
      if (breakPoint && pins[feature.holeNumber].lineBreak == null) {
        pins[feature.holeNumber].lineBreak = breakPoint;
      }
      continue;
    }

    if (feature.featureType === "tee" && geometry.type === "Point") {
      const [lng, lat] = geometry.coordinates as [number, number];
      const parsed = parseManualTeeOsmId(feature.osmId);
      const teeKey = parsed?.teeKey ?? "white";
      pins[feature.holeNumber].tees[teeKey] = { lat, lng };
    }

    if (feature.featureType === "green" && geometry.type === "Polygon") {
      const ring = (geometry.coordinates as [number, number][][])[0] ?? [];
      if (ring.length > 0) {
        const sum = ring.reduce(
          (acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
          { lat: 0, lng: 0 }
        );
        pins[feature.holeNumber].green = {
          lat: sum.lat / ring.length,
          lng: sum.lng / ring.length,
        };
      }
    }
  }

  return pins;
}

export async function upsertManualHoleFeature(
  courseId: string,
  holeNumber: number,
  featureType: "tee" | "green" | "hole_line",
  geometry: unknown,
  osmId: string
) {
  const db = getDb();
  const existing = await db.query.holeFeatures.findFirst({
    where: and(
      eq(holeFeatures.courseId, courseId),
      eq(holeFeatures.osmId, osmId)
    ),
  });

  const row = {
    holeNumber,
    featureType,
    geometry,
    source: "manual" as const,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(holeFeatures).set(row).where(eq(holeFeatures.id, existing.id));
    return;
  }

  await db.insert(holeFeatures).values({
    courseId,
    osmId,
    ...row,
  });
}

export async function upsertManualGreenTargets(
  courseId: string,
  holeNumber: number,
  targets: { front: LatLng; middle: LatLng; back: LatLng }
) {
  const db = getDb();

  for (const [targetType, point] of Object.entries(targets) as [
    "front" | "middle" | "back",
    LatLng,
  ][]) {
    const existing = await db.query.greenTargets.findFirst({
      where: and(
        eq(greenTargets.courseId, courseId),
        eq(greenTargets.holeNumber, holeNumber),
        eq(greenTargets.targetType, targetType)
      ),
    });

    const row = {
      latitude: String(point.lat),
      longitude: String(point.lng),
      computedFrom: "manual" as const,
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(greenTargets)
        .set(row)
        .where(eq(greenTargets.id, existing.id));
      continue;
    }

    await db.insert(greenTargets).values({
      courseId,
      holeNumber,
      targetType,
      ...row,
    });
  }
}

async function refreshCourseMappedHoleCount(courseId: string) {
  const db = getDb();
  const mappedHoles = await db.query.greenTargets.findMany({
    where: and(
      eq(greenTargets.courseId, courseId),
      eq(greenTargets.targetType, "middle")
    ),
  });

  const uniqueHoles = new Set(mappedHoles.map((target) => target.holeNumber));

  await db
    .update(golfCourses)
    .set({
      mappedHoleCount: uniqueHoles.size,
      dataQuality:
        uniqueHoles.size > 0 ? "geometry_targets" : "geometry_only",
      updatedAt: new Date(),
    })
    .where(eq(golfCourses.id, courseId));

  return uniqueHoles.size;
}

async function recomputeGreenTargetsForHole(
  courseId: string,
  holeNumber: number,
  tee?: LatLng,
  green?: LatLng
) {
  const db = getDb();
  let teePoint = tee ?? null;
  let greenPoint = green ?? null;

  if (!teePoint) {
    const teeFeatures = await db.query.holeFeatures.findMany({
      where: and(
        eq(holeFeatures.courseId, courseId),
        eq(holeFeatures.holeNumber, holeNumber),
        eq(holeFeatures.featureType, "tee")
      ),
    });

    for (const feature of teeFeatures) {
      const geometry = feature.geometry as {
        type?: string;
        coordinates?: [number, number];
      };
      if (geometry.type !== "Point" || !geometry.coordinates) continue;
      const [lng, lat] = geometry.coordinates;
      teePoint = { lat, lng };
      break;
    }
  }

  if (!greenPoint) {
    const greenFeature = await db.query.holeFeatures.findFirst({
      where: and(
        eq(holeFeatures.courseId, courseId),
        eq(holeFeatures.holeNumber, holeNumber),
        eq(holeFeatures.featureType, "green")
      ),
    });
    const geometry = greenFeature?.geometry as {
      type?: string;
      coordinates?: [number, number][][];
    } | null;
    if (geometry?.type === "Polygon" && geometry.coordinates) {
      const ring = geometry.coordinates[0] ?? [];
      if (ring.length > 0) {
        const sum = ring.reduce(
          (acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
          { lat: 0, lng: 0 }
        );
        greenPoint = {
          lat: sum.lat / ring.length,
          lng: sum.lng / ring.length,
        };
      }
    }
  }

  if (!teePoint || !greenPoint) return;

  const targets = manualTargetsFromPins(teePoint, greenPoint);
  if (!targets) return;

  await upsertManualGreenTargets(courseId, holeNumber, targets);
}

export async function saveManualHoleLine(
  courseId: string,
  holeNumber: number,
  teeKey: string,
  tee: LatLng,
  green: LatLng,
  breakPoint: LatLng | null
) {
  const path =
    breakPoint != null ? [tee, breakPoint, green] : [tee, green];

  await upsertManualHoleFeature(
    courseId,
    holeNumber,
    "hole_line",
    holeLinePathGeometry(path),
    manualHoleLineOsmId(holeNumber, teeKey)
  );
}

async function resolveSharedLineBreakForHole(
  features: {
    featureType: string;
    geometry: unknown;
  }[],
  _tee: LatLng,
  _green: LatLng
): Promise<LatLng | null> {
  for (const feature of features) {
    if (feature.featureType !== "hole_line") continue;
    const path = lineStringToPath(feature.geometry);
    if (path.length === 2) return null;
    if (path.length >= 3) {
      const breakPoint = breakPointFromLinePath(
        path,
        path[0]!,
        path[path.length - 1]!
      );
      if (breakPoint) return breakPoint;
    }
  }

  return null;
}

async function refreshHoleLinesForHole(courseId: string, holeNumber: number) {
  const db = getDb();
  const features = await db.query.holeFeatures.findMany({
    where: and(
      eq(holeFeatures.courseId, courseId),
      eq(holeFeatures.holeNumber, holeNumber)
    ),
  });

  const greenFeature = features.find(
    (feature) => feature.featureType === "green"
  );
  const green = greenFeature
    ? await resolveGreenCenter(greenFeature.geometry)
    : null;
  if (!green) return;

  const teeFeatures = features.filter((feature) => feature.featureType === "tee");
  const primaryTeeFeature = teeFeatures[0];
  const primaryTeeGeometry = primaryTeeFeature?.geometry as {
    type?: string;
    coordinates?: [number, number];
  };
  const primaryTee =
    primaryTeeGeometry?.type === "Point" && primaryTeeGeometry.coordinates
      ? {
          lat: primaryTeeGeometry.coordinates[1],
          lng: primaryTeeGeometry.coordinates[0],
        }
      : null;
  const sharedBreak = primaryTee
    ? await resolveSharedLineBreakForHole(features, primaryTee, green)
    : null;

  for (const feature of teeFeatures) {
    const parsedTee = parseManualTeeOsmId(feature.osmId);
    if (!parsedTee) continue;

    const geometry = feature.geometry as {
      type?: string;
      coordinates?: [number, number];
    };
    if (geometry.type !== "Point" || !geometry.coordinates) continue;
    const [lng, lat] = geometry.coordinates;
    const tee = { lat, lng };

    await saveManualHoleLine(
      courseId,
      holeNumber,
      parsedTee.teeKey,
      tee,
      green,
      sharedBreak
    );
  }
}

export async function setManualHoleDogleg(
  courseId: string,
  holeNumber: number,
  enabled: boolean
) {
  const db = getDb();
  const features = await db.query.holeFeatures.findMany({
    where: and(
      eq(holeFeatures.courseId, courseId),
      eq(holeFeatures.holeNumber, holeNumber)
    ),
  });

  const greenFeature = features.find(
    (feature) => feature.featureType === "green"
  );
  const green = greenFeature
    ? await resolveGreenCenter(greenFeature.geometry)
    : null;
  if (!green) return;

  const teeFeatures = features.filter((feature) => feature.featureType === "tee");
  let breakPoint: LatLng | null = null;

  if (enabled) {
    let farthestTee: LatLng | null = null;
    let farthestYards = -1;

    for (const feature of teeFeatures) {
      const geometry = feature.geometry as {
        type?: string;
        coordinates?: [number, number];
      };
      if (geometry.type !== "Point" || !geometry.coordinates) continue;
      const [lng, lat] = geometry.coordinates;
      const tee = { lat, lng };
      const yards = yardsBetween(tee, green);
      if (yards > farthestYards) {
        farthestYards = yards;
        farthestTee = tee;
      }
    }

    breakPoint = farthestTee ? midpoint(farthestTee, green) : null;
  }

  for (const feature of teeFeatures) {
    const parsedTee = parseManualTeeOsmId(feature.osmId);
    if (!parsedTee) continue;

    const geometry = feature.geometry as {
      type?: string;
      coordinates?: [number, number];
    };
    if (geometry.type !== "Point" || !geometry.coordinates) continue;
    const [lng, lat] = geometry.coordinates;
    const tee = { lat, lng };

    await saveManualHoleLine(
      courseId,
      holeNumber,
      parsedTee.teeKey,
      tee,
      green,
      breakPoint
    );
  }
}

export async function saveManualLineBreak(
  courseId: string,
  holeNumber: number,
  breakPoint: LatLng
) {
  const db = getDb();
  const features = await db.query.holeFeatures.findMany({
    where: and(
      eq(holeFeatures.courseId, courseId),
      eq(holeFeatures.holeNumber, holeNumber)
    ),
  });

  const greenFeature = features.find(
    (feature) => feature.featureType === "green"
  );
  const green = greenFeature
    ? await resolveGreenCenter(greenFeature.geometry)
    : null;
  if (!green) return;

  let primaryTee: LatLng | null = null;

  for (const feature of features) {
    if (feature.featureType !== "tee") continue;
    const parsedTee = parseManualTeeOsmId(feature.osmId);
    if (!parsedTee) continue;

    const geometry = feature.geometry as {
      type?: string;
      coordinates?: [number, number];
    };
    if (geometry.type !== "Point" || !geometry.coordinates) continue;
    const [lng, lat] = geometry.coordinates;
    const tee = { lat, lng };
    primaryTee ??= tee;

    await saveManualHoleLine(
      courseId,
      holeNumber,
      parsedTee.teeKey,
      tee,
      green,
      breakPoint
    );
  }

  if (primaryTee) {
    await recomputeGreenTargetsForHole(courseId, holeNumber, primaryTee, green);
  }
}

export async function saveManualGreenPin(
  courseId: string,
  holeNumber: number,
  green: LatLng
) {
  const greenGeometry = greenPolygonAroundPoint(green);

  await upsertManualHoleFeature(
    courseId,
    holeNumber,
    "green",
    greenGeometry,
    `manual:green:${holeNumber}`
  );

  await recomputeGreenTargetsForHole(courseId, holeNumber, undefined, green);
  await refreshHoleLinesForHole(courseId, holeNumber);
  return refreshCourseMappedHoleCount(courseId);
}

export async function saveManualTeePin(
  courseId: string,
  holeNumber: number,
  teeKey: string,
  tee: LatLng
) {
  await upsertManualHoleFeature(
    courseId,
    holeNumber,
    "tee",
    pointGeometry(tee),
    manualTeeOsmId(holeNumber, teeKey)
  );

  const db = getDb();
  const greenFeature = await db.query.holeFeatures.findFirst({
    where: and(
      eq(holeFeatures.courseId, courseId),
      eq(holeFeatures.holeNumber, holeNumber),
      eq(holeFeatures.featureType, "green")
    ),
  });

  if (greenFeature) {
    const greenCenter = await resolveGreenCenter(greenFeature.geometry);
    if (greenCenter) {
      const holeFeaturesForHole = await db.query.holeFeatures.findMany({
        where: and(
          eq(holeFeatures.courseId, courseId),
          eq(holeFeatures.holeNumber, holeNumber)
        ),
      });
      const breakPoint = await resolveSharedLineBreakForHole(
        holeFeaturesForHole,
        tee,
        greenCenter
      );

      await saveManualHoleLine(
        courseId,
        holeNumber,
        teeKey,
        tee,
        greenCenter,
        breakPoint
      );
      await recomputeGreenTargetsForHole(
        courseId,
        holeNumber,
        tee,
        greenCenter
      );
    }
  }

  return refreshCourseMappedHoleCount(courseId);
}

async function resolveGreenCenter(geometry: unknown): Promise<LatLng | null> {
  const polygon = geometry as {
    type?: string;
    coordinates?: [number, number][][];
  };
  if (polygon.type !== "Polygon") return null;
  const ring = polygon.coordinates?.[0] ?? [];
  if (ring.length === 0) return null;
  const sum = ring.reduce(
    (acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / ring.length, lng: sum.lng / ring.length };
}

/** @deprecated Use saveManualGreenPin / saveManualTeePin */
export async function saveManualHolePins(
  courseId: string,
  holeNumber: number,
  tee: LatLng,
  green: LatLng
) {
  await saveManualGreenPin(courseId, holeNumber, green);
  await saveManualTeePin(courseId, holeNumber, "white", tee);
  return refreshCourseMappedHoleCount(courseId);
}

export async function replaceCourseTees(courseId: string, tees: CourseTeeInput[]) {
  const db = getDb();
  await db.delete(courseTees).where(eq(courseTees.courseId, courseId));

  if (tees.length === 0) return;

  await db.insert(courseTees).values(
    tees.map((tee) => ({
      courseId,
      teeKey: tee.teeKey,
      teeName: tee.teeName,
      teeColor: tee.teeColor ?? null,
      sortOrder: tee.sortOrder,
      courseRating: tee.courseRating ?? null,
      slope: tee.slope ?? null,
      totalYardage: tee.totalYardage ?? null,
    }))
  );
}

export async function replaceCourseHoles(
  courseId: string,
  holes: {
    holeNumber: number;
    par: number;
    yardage: number | null;
    teeYardages?: Record<string, number> | null;
    strokeIndex: number | null;
    ladiesStrokeIndex?: number | null;
  }[]
) {
  const db = getDb();
  await db.delete(courseHoles).where(eq(courseHoles.courseId, courseId));

  if (holes.length === 0) return;

  await db.insert(courseHoles).values(
    holes.map((hole) => ({
      courseId,
      holeNumber: hole.holeNumber,
      par: hole.par,
      yardage: hole.yardage,
      teeYardages: hole.teeYardages ?? null,
      strokeIndex: hole.strokeIndex,
      ladiesStrokeIndex: hole.ladiesStrokeIndex ?? null,
    }))
  );
}

export type CourseDuplicateMatch = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  onboardingStatus: GolfCourse["onboardingStatus"];
  status: GolfCourse["status"];
  matchType: "exact" | "name";
};

export async function findDuplicateCourses(input: {
  name: string;
  city?: string | null;
  state?: string | null;
  country?: CourseCountry | null;
  excludeCourseId?: string;
}): Promise<CourseDuplicateMatch[]> {
  const normalizedName = normalizeCourseMatchText(input.name);
  if (normalizedName.length < 2) return [];

  const searchName = input.name.trim();
  const candidates = await getDb().query.golfCourses.findMany({
    columns: {
      id: true,
      name: true,
      city: true,
      state: true,
      country: true,
      onboardingStatus: true,
      status: true,
    },
    where: ilike(golfCourses.name, `%${searchName}%`),
    limit: 25,
  });

  const normalizedCity = normalizeCourseMatchText(input.city);
  const normalizedState = normalizeCourseMatchText(input.state);
  const country = parseCourseCountry(input.country ?? "US");

  const matches: CourseDuplicateMatch[] = [];

  for (const course of candidates) {
    if (course.id === input.excludeCourseId) continue;
    if (normalizeCourseMatchText(course.name) !== normalizedName) continue;

    const courseCountry = parseCourseCountry(course.country);
    if (courseCountry !== country) continue;

    const courseCity = normalizeCourseMatchText(course.city);
    const courseState = normalizeCourseMatchText(course.state);

    if (normalizedCity.length >= 2 && courseCity.length >= 2) {
      if (normalizedCity !== courseCity) continue;
      if (
        normalizedState.length >= 2 &&
        courseState.length >= 2 &&
        normalizedState !== courseState
      ) {
        continue;
      }

      matches.push({
        ...course,
        matchType: "exact",
      });
      continue;
    }

    matches.push({
      ...course,
      matchType: "name",
    });
  }

  return matches.sort((left, right) => {
    if (left.matchType !== right.matchType) {
      return left.matchType === "exact" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export function duplicateCourseError(matches: CourseDuplicateMatch[]): string {
  const primary = matches.find((match) => match.matchType === "exact") ?? matches[0];
  if (!primary) return "This course already exists in the database.";

  const location = [primary.city, primary.state].filter(Boolean).join(", ");
  const statusLabel =
    primary.onboardingStatus === "verified"
      ? "verified"
      : primary.onboardingStatus.replace("_", " ");

  if (primary.matchType === "exact") {
    return `A matching course already exists${location ? ` in ${location}` : ""} (${statusLabel}).`;
  }

  return `A course named "${primary.name}" already exists (${statusLabel}). Add the city to confirm whether this is a duplicate.`;
}

export function verifiedCourseToDetail(
  course: GolfCourse & { courseHoles: CourseHole[]; courseTees?: CourseTee[] }
): CourseDetail {
  const latitude = parseCoordinate(course.latitude);
  const longitude = parseCoordinate(course.longitude);
  const sortedTees = sortCourseTees(course.courseTees ?? []);
  const defaultTeeKey = sortedTees[0]?.teeKey ?? null;

  const holesData = course.courseHoles.map((hole) => ({
    number: hole.holeNumber,
    par: hole.par,
    handicap_index: hole.strokeIndex,
    ladies_handicap_index: hole.ladiesStrokeIndex,
    yardages: hole.teeYardages ?? (hole.yardage != null ? { default: hole.yardage } : null),
  }));

  const scorecard = course.courseHoles.map((hole) => ({
    hole: hole.holeNumber,
    par: hole.par,
    yardage:
      (defaultTeeKey ? hole.teeYardages?.[defaultTeeKey] : null) ??
      hole.yardage,
    handicap_index: hole.strokeIndex,
    ladies_handicap_index: hole.ladiesStrokeIndex,
  }));

  const tees = sortedTees.map((tee) => ({
    tee_key: tee.teeKey,
    tee_name: tee.teeName,
    tee_color: tee.teeColor,
    course_rating: tee.courseRating ? Number(tee.courseRating) : null,
    slope: tee.slope,
    yardage:
      tee.totalYardage ?? totalYardageForTee(tee.teeKey, course.courseHoles),
    par: course.courseHoles.reduce((sum, hole) => sum + hole.par, 0),
  }));

  return {
    id: course.externalCourseId ?? course.id,
    name: course.name,
    course_name: course.name,
    city: course.city,
    state: course.state,
    country: parseCourseCountry(course.country),
    address: course.address,
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    par: course.courseHoles.reduce((sum, hole) => sum + hole.par, 0),
    holes: course.holeCount,
    holes_data: holesData,
    scorecard,
    tees,
  };
}

export async function getVerifiedCourseDetail(
  courseId: string
): Promise<CourseDetail | null> {
  const db = getDb();
  const course =
    (await db.query.golfCourses.findFirst({
      where: and(
        eq(golfCourses.externalCourseId, courseId),
        eq(golfCourses.onboardingStatus, "verified"),
        eq(golfCourses.status, "published")
      ),
      with: {
        courseTees: {
          orderBy: [asc(courseTees.sortOrder), asc(courseTees.teeName)],
        },
        courseHoles: {
          orderBy: [asc(courseHoles.holeNumber)],
        },
      },
    })) ??
    (await db.query.golfCourses.findFirst({
      where: and(
        eq(golfCourses.id, courseId),
        eq(golfCourses.onboardingStatus, "verified"),
        eq(golfCourses.status, "published")
      ),
      with: {
        courseTees: {
          orderBy: [asc(courseTees.sortOrder), asc(courseTees.teeName)],
        },
        courseHoles: {
          orderBy: [asc(courseHoles.holeNumber)],
        },
      },
    }));

  if (!course || course.courseHoles.length === 0) return null;
  return verifiedCourseToDetail(course);
}

export async function searchVerifiedCourses(query: string, limit = 8) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return getDb().query.golfCourses.findMany({
    where: and(
      eq(golfCourses.onboardingStatus, "verified"),
      eq(golfCourses.status, "published"),
      or(
        ilike(golfCourses.name, `%${trimmed}%`),
        ilike(golfCourses.city, `%${trimmed}%`)
      )
    ),
    orderBy: [desc(golfCourses.verifiedAt), asc(golfCourses.name)],
    limit,
    with: {
      courseTees: true,
      courseHoles: true,
    },
  });
}
