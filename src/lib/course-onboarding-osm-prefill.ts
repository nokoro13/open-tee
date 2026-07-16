import type { CourseHole, CourseTee } from "@/db/schema";
import {
  breakPointFromLinePath,
  holeNumbersForCount,
  saveManualGreenPin,
  saveManualLineBreak,
  saveManualTeePin,
} from "@/lib/course-onboarding";
import type { LatLng } from "@/lib/green-distance";
import { assignOsmFeaturesToHoles } from "@/lib/hole-spatial-features";
import {
  assignGreensToHoles,
  fetchOsmGolfFeaturesNear,
  type OsmGolfFeature,
} from "@/lib/overpass-golf";
import { sortCourseTees } from "@/lib/course-tees";

export type OsmPrefillCoverage = {
  greensFound: number;
  holeLinesFound: number;
  osmTeesFound: number;
  holesMissing: number[];
  totalHoles: number;
  overpassError: string | null;
};

export type OsmPrefillHoleDraft = {
  holeNumber: number;
  green: LatLng | null;
  primaryTee: LatLng | null;
  breakPoint: LatLng | null;
  teesByKey: Record<string, LatLng>;
};

type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

function lineStringToPath(geometry: LineStringGeometry): LatLng[] {
  return geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

function interpolateTeePosition(
  primaryTee: LatLng,
  green: LatLng,
  primaryYardage: number,
  targetYardage: number
): LatLng {
  const ratio = targetYardage / primaryYardage;
  return {
    lat: green.lat + (primaryTee.lat - green.lat) * ratio,
    lng: green.lng + (primaryTee.lng - green.lng) * ratio,
  };
}

function resolvePrimaryTee(
  holeFeatures: OsmGolfFeature[],
  holeLine: OsmGolfFeature | null
): LatLng | null {
  const taggedTee = holeFeatures.find((feature) => feature.featureType === "tee");
  if (taggedTee) return taggedTee.center;

  if (holeLine?.geometry?.type === "LineString") {
    const [lng, lat] = holeLine.geometry.coordinates[0]!;
    return { lat, lng };
  }

  return null;
}

function resolveHoleLine(
  holeFeatures: OsmGolfFeature[]
): { path: LatLng[]; feature: OsmGolfFeature } | null {
  const holeLine = holeFeatures.find((feature) => feature.featureType === "hole");
  if (!holeLine?.geometry || holeLine.geometry.type !== "LineString") {
    return null;
  }

  return {
    feature: holeLine,
    path: lineStringToPath(holeLine.geometry),
  };
}

function buildTeesForHole(
  primaryTee: LatLng,
  green: LatLng,
  courseTees: Pick<CourseTee, "teeKey" | "teeName" | "sortOrder">[],
  courseHole?: Pick<CourseHole, "teeYardages" | "yardage">
): Record<string, LatLng> {
  const sorted = sortCourseTees(courseTees);
  if (sorted.length === 0) return {};

  const yardages = sorted.map((tee) => ({
    teeKey: tee.teeKey,
    yardage:
      courseHole?.teeYardages?.[tee.teeKey] ??
      (sorted[0]?.teeKey === tee.teeKey ? courseHole?.yardage ?? null : null),
  }));

  const validYardages = yardages.filter(
    (entry): entry is { teeKey: string; yardage: number } =>
      entry.yardage != null && entry.yardage > 0
  );

  if (validYardages.length === 0) {
    return { [sorted[0]!.teeKey]: primaryTee };
  }

  const primaryEntry = validYardages.reduce((longest, current) =>
    current.yardage > longest.yardage ? current : longest
  );

  const teesByKey: Record<string, LatLng> = {};
  for (const entry of validYardages) {
    teesByKey[entry.teeKey] =
      entry.teeKey === primaryEntry.teeKey
        ? primaryTee
        : interpolateTeePosition(
            primaryTee,
            green,
            primaryEntry.yardage,
            entry.yardage
          );
  }

  return teesByKey;
}

export async function buildOsmOnboardingDraft(options: {
  latitude: number;
  longitude: number;
  holeCount: number;
  courseHoles?: Pick<CourseHole, "holeNumber" | "teeYardages" | "yardage">[];
  courseTees?: Pick<CourseTee, "teeKey" | "teeName" | "sortOrder">[];
}): Promise<{
  coverage: OsmPrefillCoverage;
  holes: OsmPrefillHoleDraft[];
}> {
  const holeNumbers = holeNumbersForCount(options.holeCount);
  const courseTees = options.courseTees ?? [];
  const courseHolesByNumber = new Map(
    (options.courseHoles ?? []).map((hole) => [hole.holeNumber, hole])
  );

  let overpassError: string | null = null;
  let allFeatures: OsmGolfFeature[] = [];

  try {
    allFeatures = await fetchOsmGolfFeaturesNear(
      options.latitude,
      options.longitude
    );
  } catch (error) {
    overpassError =
      error instanceof Error ? error.message : "OpenStreetMap request failed.";
  }

  const greenAssignment = assignGreensToHoles(allFeatures, holeNumbers);
  const assignedFeatures = assignOsmFeaturesToHoles(allFeatures, holeNumbers);

  let greensFound = 0;
  let holeLinesFound = 0;
  let osmTeesFound = 0;
  const holesMissing: number[] = [];
  const holes: OsmPrefillHoleDraft[] = [];

  for (const holeNumber of holeNumbers) {
    const holeFeatureList = assignedFeatures.get(holeNumber) ?? [];
    const assignedGreen = greenAssignment.byHole[holeNumber];
    const green = assignedGreen?.center ?? null;

    const holeLine = resolveHoleLine(holeFeatureList);
    const primaryTee = resolvePrimaryTee(holeFeatureList, holeLine?.feature ?? null);

    if (green) greensFound += 1;
    if (holeLine) holeLinesFound += 1;
    if (holeFeatureList.some((feature) => feature.featureType === "tee")) {
      osmTeesFound += 1;
    }

    if (!green || !primaryTee) {
      holesMissing.push(holeNumber);
      holes.push({
        holeNumber,
        green,
        primaryTee,
        breakPoint: null,
        teesByKey: {},
      });
      continue;
    }

    const linePath = holeLine?.path ?? [primaryTee, green];
    const breakPoint =
      linePath.length >= 3
        ? breakPointFromLinePath(linePath, primaryTee, green)
        : null;

    const teesByKey = buildTeesForHole(
      primaryTee,
      green,
      courseTees,
      courseHolesByNumber.get(holeNumber)
    );

    holes.push({
      holeNumber,
      green,
      primaryTee,
      breakPoint,
      teesByKey,
    });
  }

  return {
    coverage: {
      greensFound,
      holeLinesFound,
      osmTeesFound,
      holesMissing,
      totalHoles: holeNumbers.length,
      overpassError,
    },
    holes,
  };
}

export async function applyOsmOnboardingPrefill(options: {
  courseId: string;
  latitude: number;
  longitude: number;
  holeCount: number;
  courseHoles: Pick<CourseHole, "holeNumber" | "teeYardages" | "yardage">[];
  courseTees: Pick<CourseTee, "teeKey" | "teeName" | "sortOrder">[];
}): Promise<{
  coverage: OsmPrefillCoverage;
  appliedHoleCount: number;
}> {
  const { coverage, holes } = await buildOsmOnboardingDraft({
    latitude: options.latitude,
    longitude: options.longitude,
    holeCount: options.holeCount,
    courseHoles: options.courseHoles,
    courseTees: options.courseTees,
  });

  if (coverage.overpassError && coverage.greensFound === 0) {
    throw new Error(coverage.overpassError);
  }

  let appliedHoleCount = 0;

  for (const hole of holes) {
    if (!hole.green || Object.keys(hole.teesByKey).length === 0) continue;

    await saveManualGreenPin(options.courseId, hole.holeNumber, hole.green);

    for (const [teeKey, teePosition] of Object.entries(hole.teesByKey)) {
      await saveManualTeePin(
        options.courseId,
        hole.holeNumber,
        teeKey,
        teePosition
      );
    }

    if (hole.breakPoint) {
      await saveManualLineBreak(
        options.courseId,
        hole.holeNumber,
        hole.breakPoint
      );
    }

    appliedHoleCount += 1;
  }

  return { coverage, appliedHoleCount };
}
