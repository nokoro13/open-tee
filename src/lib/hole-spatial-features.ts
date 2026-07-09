import { yardsBetween, type LatLng } from "@/lib/green-distance";
import type { OsmGolfFeature } from "@/lib/overpass-golf";

type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

type PolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

type MultiPolygonGeometry = {
  type: "MultiPolygon";
  coordinates: [number, number][][][];
};

type PointGeometry = {
  type: "Point";
  coordinates: [number, number];
};

const FAIRWAY_CORRIDOR_YARDS = 130;
const ROUGH_CORRIDOR_YARDS = 160;
const DEFAULT_CORRIDOR_YARDS = 100;
const TREE_CORRIDOR_YARDS = 85;
const MAX_TREES_PER_HOLE = 48;

const TAGGED_FEATURE_TYPES = new Set<OsmGolfFeature["featureType"]>([
  "green",
  "hole",
  "fairway",
  "bunker",
  "tee",
  "water",
  "rough",
  "out_of_bounds",
  "cartpath",
  "scrub",
  "tree",
]);

const SPATIAL_FEATURE_TYPES = new Set<OsmGolfFeature["featureType"]>([
  "fairway",
  "bunker",
  "tee",
  "water",
  "rough",
  "out_of_bounds",
  "cartpath",
  "scrub",
  "tree",
]);

function corridorYardsForFeature(featureType: OsmGolfFeature["featureType"]) {
  switch (featureType) {
    case "fairway":
      return FAIRWAY_CORRIDOR_YARDS;
    case "rough":
      return ROUGH_CORRIDOR_YARDS;
    case "tree":
      return TREE_CORRIDOR_YARDS;
    default:
      return DEFAULT_CORRIDOR_YARDS;
  }
}

function pointToSegmentDistanceYards(
  point: LatLng,
  start: LatLng,
  end: LatLng
): number {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    111_320 * Math.cos((point.lat * Math.PI) / 180);

  const px = (point.lng - start.lng) * metersPerDegreeLng;
  const py = (point.lat - start.lat) * metersPerDegreeLat;
  const sx = (end.lng - start.lng) * metersPerDegreeLng;
  const sy = (end.lat - start.lat) * metersPerDegreeLat;

  const segmentLengthSq = sx * sx + sy * sy;
  if (segmentLengthSq === 0) {
    return yardsBetween(point, start);
  }

  const t = Math.max(0, Math.min(1, (px * sx + py * sy) / segmentLengthSq));
  const closest = {
    lat: start.lat + (t * (end.lat - start.lat)),
    lng: start.lng + (t * (end.lng - start.lng)),
  };

  return yardsBetween(point, closest);
}

export function distancePointToLineStringYards(
  point: LatLng,
  line: LineStringGeometry
): number {
  if (line.coordinates.length === 0) return Infinity;
  if (line.coordinates.length === 1) {
    const [lng, lat] = line.coordinates[0]!;
    return yardsBetween(point, { lat, lng });
  }

  let best = Infinity;
  for (let index = 0; index < line.coordinates.length - 1; index += 1) {
    const [startLng, startLat] = line.coordinates[index]!;
    const [endLng, endLat] = line.coordinates[index + 1]!;
    const distance = pointToSegmentDistanceYards(
      point,
      { lat: startLat, lng: startLng },
      { lat: endLat, lng: endLng }
    );
    if (distance < best) best = distance;
  }

  return best;
}

function featureTouchesHole(
  feature: OsmGolfFeature,
  holeLine: LineStringGeometry
): boolean {
  const maxDistance = corridorYardsForFeature(feature.featureType);

  if (distancePointToLineStringYards(feature.center, holeLine) <= maxDistance) {
    return true;
  }

  if (!feature.geometry) return false;

  const geometry = feature.geometry as
    | PolygonGeometry
    | MultiPolygonGeometry
    | LineStringGeometry
    | PointGeometry;

  const samplePoints: LatLng[] = [];
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates;
    samplePoints.push({ lat, lng });
  } else if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      for (const [lng, lat] of ring) {
        samplePoints.push({ lat, lng });
      }
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const [lng, lat] of ring) {
          samplePoints.push({ lat, lng });
        }
      }
    }
  } else if (geometry.type === "LineString") {
    for (const [lng, lat] of geometry.coordinates) {
      samplePoints.push({ lat, lng });
    }
  }

  for (const sample of samplePoints) {
    if (distancePointToLineStringYards(sample, holeLine) <= maxDistance) {
      return true;
    }
  }

  return false;
}

export function assignOsmFeaturesToHoles(
  allFeatures: OsmGolfFeature[],
  holeNumbers: number[]
): Map<number, OsmGolfFeature[]> {
  const holeLines = new Map<number, LineStringGeometry>();

  for (const feature of allFeatures) {
    if (
      feature.featureType !== "hole" ||
      feature.holeNumber == null ||
      !holeNumbers.includes(feature.holeNumber) ||
      feature.geometry?.type !== "LineString"
    ) {
      continue;
    }

    holeLines.set(feature.holeNumber, feature.geometry);
  }

  const assigned = new Map<number, OsmGolfFeature[]>(
    holeNumbers.map((holeNumber) => [holeNumber, []])
  );
  const seenByHole = new Map<number, Set<string>>(
    holeNumbers.map((holeNumber) => [holeNumber, new Set<string>()])
  );
  const treeCountByHole = new Map<number, number>(
    holeNumbers.map((holeNumber) => [holeNumber, 0])
  );

  function addFeature(holeNumber: number, feature: OsmGolfFeature) {
    const seen = seenByHole.get(holeNumber);
    if (!seen || seen.has(feature.osmId)) return;

    if (feature.featureType === "tree") {
      const treeCount = treeCountByHole.get(holeNumber) ?? 0;
      if (treeCount >= MAX_TREES_PER_HOLE) return;
      treeCountByHole.set(holeNumber, treeCount + 1);
    }

    seen.add(feature.osmId);
    assigned.get(holeNumber)?.push(feature);
  }

  for (const feature of allFeatures) {
    if (feature.holeNumber == null || !holeNumbers.includes(feature.holeNumber)) {
      continue;
    }

    if (TAGGED_FEATURE_TYPES.has(feature.featureType)) {
      addFeature(feature.holeNumber, feature);
    }
  }

  for (const feature of allFeatures) {
    if (feature.holeNumber != null) continue;
    if (!SPATIAL_FEATURE_TYPES.has(feature.featureType)) continue;
    if (!feature.geometry) continue;

    let bestHole: number | null = null;
    let bestDistance = Infinity;

    for (const holeNumber of holeNumbers) {
      const holeLine = holeLines.get(holeNumber);
      if (!holeLine) continue;

      const distance = distancePointToLineStringYards(feature.center, holeLine);
      const maxDistance = corridorYardsForFeature(feature.featureType);

      if (distance <= maxDistance && distance < bestDistance) {
        bestDistance = distance;
        bestHole = holeNumber;
      }
    }

    if (bestHole != null && featureTouchesHole(feature, holeLines.get(bestHole)!)) {
      addFeature(bestHole, feature);
    }
  }

  return assigned;
}

export type HoleFeatureType =
  | "green"
  | "tee"
  | "fairway"
  | "hole_line"
  | "bunker"
  | "water"
  | "rough"
  | "out_of_bounds"
  | "cartpath"
  | "scrub"
  | "tree";

export function osmFeatureTypeToHoleFeatureType(
  featureType: OsmGolfFeature["featureType"]
): HoleFeatureType | null {
  switch (featureType) {
    case "green":
      return "green";
    case "tee":
      return "tee";
    case "fairway":
      return "fairway";
    case "hole":
      return "hole_line";
    case "bunker":
      return "bunker";
    case "water":
      return "water";
    case "rough":
      return "rough";
    case "out_of_bounds":
      return "out_of_bounds";
    case "cartpath":
      return "cartpath";
    case "scrub":
      return "scrub";
    case "tree":
      return "tree";
    default:
      return null;
  }
}
