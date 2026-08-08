import { yardsBetween, type LatLng } from "@/lib/green-distance";

type OsmGeometry =
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Point"; coordinates: [number, number] };

export type OsmGolfFeature = {
  osmId: string;
  featureType:
    | "green"
    | "tee"
    | "fairway"
    | "hole"
    | "bunker"
    | "water"
    | "rough"
    | "out_of_bounds"
    | "cartpath"
    | "scrub"
    | "tree";
  holeNumber: number | null;
  /** Parsed from `golf:course` or refs like `5/18`. */
  courseHoleCount: number | null;
  center: LatLng;
  geometry: OsmGeometry | null;
};

type OverpassElement = {
  type: "way" | "relation" | "node";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: {
    type: string;
    ref: number;
    role?: string;
    geometry?: { lat: number; lon: number }[];
  }[];
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_FALLBACK_URL = "https://overpass.kumi.systems/api/interpreter";
const OVERPASS_USER_AGENT =
  "OpenTee/1.0 (course mapping; contact: support@openround.app)";

const POLYGON_FEATURE_TYPES = new Set<OsmGolfFeature["featureType"]>([
  "green",
  "fairway",
  "bunker",
  "water",
  "rough",
  "scrub",
]);

const LINE_FEATURE_TYPES = new Set<OsmGolfFeature["featureType"]>([
  "hole",
  "out_of_bounds",
  "cartpath",
]);

function parseCourseHoleCountFromTag(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const holeSuffix = normalized.match(/^(\d+)_hole$/);
  if (holeSuffix) {
    const count = Number.parseInt(holeSuffix[1]!, 10);
    return Number.isFinite(count) && count >= 1 ? count : null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
}

function parseHoleRef(
  raw: string
): { holeNumber: number | null; courseHoleCount: number | null } {
  const slashMatch = raw.trim().match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (slashMatch) {
    const holeNumber = Number.parseInt(slashMatch[1]!, 10);
    const courseHoleCount = Number.parseInt(slashMatch[2]!, 10);
    if (
      Number.isFinite(holeNumber) &&
      Number.isFinite(courseHoleCount) &&
      holeNumber >= 1 &&
      courseHoleCount >= 1
    ) {
      return { holeNumber, courseHoleCount };
    }
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 18) {
    return { holeNumber: parsed, courseHoleCount: null };
  }

  return { holeNumber: null, courseHoleCount: null };
}

export function parseOsmHoleTags(
  tags: Record<string, string> | undefined
): { holeNumber: number | null; courseHoleCount: number | null } {
  if (!tags) return { holeNumber: null, courseHoleCount: null };

  let holeNumber: number | null = null;
  let courseHoleCount: number | null = null;

  const courseTag = tags["golf:course"];
  if (courseTag) {
    courseHoleCount = parseCourseHoleCountFromTag(courseTag);
  }

  for (const key of ["ref", "golf:hole", "hole"]) {
    const raw = tags[key];
    if (!raw) continue;
    const parsed = parseHoleRef(raw);
    if (parsed.holeNumber != null) {
      holeNumber = parsed.holeNumber;
      courseHoleCount ??= parsed.courseHoleCount;
      break;
    }
  }

  if (holeNumber == null) {
    const nameMatch = tags.name?.match(/hole\s*#?\s*(\d{1,2})/i);
    if (nameMatch) {
      const parsed = Number.parseInt(nameMatch[1]!, 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 18) {
        holeNumber = parsed;
      }
    }
  }

  return { holeNumber, courseHoleCount };
}


function mapGolfTag(golfTag: string | undefined): OsmGolfFeature["featureType"] | null {
  switch (golfTag) {
    case "green":
      return "green";
    case "tee":
      return "tee";
    case "fairway":
      return "fairway";
    case "hole":
      return "hole";
    case "bunker":
      return "bunker";
    case "water_hazard":
    case "lateral_water_hazard":
      return "water";
    case "rough":
      return "rough";
    case "out_of_bounds":
      return "out_of_bounds";
    case "cartpath":
    case "path":
      return "cartpath";
    default:
      return null;
  }
}

function mapEnvironmentalFeature(
  element: OverpassElement
): OsmGolfFeature["featureType"] | null {
  const tags = element.tags;
  if (!tags) return null;

  if (element.type === "node" && tags.natural === "tree") {
    return "tree";
  }

  if (tags.natural === "scrub" || tags.barrier === "hedge") {
    return "scrub";
  }

  return null;
}

function coordsFromElement(element: OverpassElement): LatLng[] {
  if (element.type === "node" && element.lat != null && element.lon != null) {
    return [{ lat: element.lat, lng: element.lon }];
  }

  if (element.geometry?.length) {
    return element.geometry.map((point) => ({
      lat: point.lat,
      lng: point.lon,
    }));
  }

  if (element.members?.length) {
    const coords: LatLng[] = [];
    for (const member of element.members) {
      if (member.geometry?.length) {
        for (const point of member.geometry) {
          coords.push({ lat: point.lat, lng: point.lon });
        }
      }
    }
    return coords;
  }

  return [];
}

function centroid(coords: LatLng[]): LatLng | null {
  if (coords.length === 0) return null;
  const sum = coords.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: sum.lat / coords.length,
    lng: sum.lng / coords.length,
  };
}

function toPolygonGeometry(coords: LatLng[]): OsmGeometry | null {
  if (coords.length < 3) return null;
  const ring = coords.map((point) => [point.lng, point.lat] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }
  return { type: "Polygon", coordinates: [ring] };
}

function toLineGeometry(coords: LatLng[]): OsmGeometry | null {
  if (coords.length < 2) return null;
  return {
    type: "LineString",
    coordinates: coords.map((point) => [point.lng, point.lat]),
  };
}

function toPointGeometry(point: LatLng): OsmGeometry {
  return {
    type: "Point",
    coordinates: [point.lng, point.lat],
  };
}

function geometryForFeature(
  featureType: OsmGolfFeature["featureType"],
  coords: LatLng[]
): OsmGeometry | null {
  if (featureType === "tree") {
    const center = coords[0];
    return center ? toPointGeometry(center) : null;
  }

  if (POLYGON_FEATURE_TYPES.has(featureType)) {
    return toPolygonGeometry(coords);
  }

  if (LINE_FEATURE_TYPES.has(featureType)) {
    return toLineGeometry(coords);
  }

  if (featureType === "tee") {
    return toPolygonGeometry(coords) ?? toLineGeometry(coords);
  }

  return toLineGeometry(coords) ?? toPolygonGeometry(coords);
}

async function runOverpassQuery(query: string): Promise<OverpassElement[]> {
  const urls = [OVERPASS_URL, OVERPASS_FALLBACK_URL];
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": OVERPASS_USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        cache: "no-store",
      });

      if (!response.ok) {
        lastError = new Error(
          `Overpass API error (${response.status}) from ${url}`
        );
        continue;
      }

      const data = (await response.json()) as { elements?: OverpassElement[] };
      return data.elements ?? [];
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Overpass request failed.");
    }
  }

  throw lastError ?? new Error("Overpass API unavailable.");
}

export async function fetchOsmGolfFeaturesNear(
  lat: number,
  lng: number,
  radiusM = 1500
): Promise<OsmGolfFeature[]> {
  const query = `
[out:json][timeout:25];
(
  way["golf"="green"](around:${radiusM},${lat},${lng});
  relation["golf"="green"](around:${radiusM},${lat},${lng});
  way["golf"="tee"](around:${radiusM},${lat},${lng});
  relation["golf"="tee"](around:${radiusM},${lat},${lng});
  way["golf"="fairway"](around:${radiusM},${lat},${lng});
  relation["golf"="fairway"](around:${radiusM},${lat},${lng});
  way["golf"="hole"](around:${radiusM},${lat},${lng});
  relation["golf"="hole"](around:${radiusM},${lat},${lng});
  way["golf"="bunker"](around:${radiusM},${lat},${lng});
  relation["golf"="bunker"](around:${radiusM},${lat},${lng});
  way["golf"="water_hazard"](around:${radiusM},${lat},${lng});
  relation["golf"="water_hazard"](around:${radiusM},${lat},${lng});
  way["golf"="lateral_water_hazard"](around:${radiusM},${lat},${lng});
  relation["golf"="lateral_water_hazard"](around:${radiusM},${lat},${lng});
  way["natural"="water"]["golf"](around:${radiusM},${lat},${lng});
  relation["natural"="water"]["golf"](around:${radiusM},${lat},${lng});
  way["golf"="rough"](around:${radiusM},${lat},${lng});
  relation["golf"="rough"](around:${radiusM},${lat},${lng});
  way["golf"="out_of_bounds"](around:${radiusM},${lat},${lng});
  relation["golf"="out_of_bounds"](around:${radiusM},${lat},${lng});
  way["golf"="cartpath"](around:${radiusM},${lat},${lng});
  relation["golf"="cartpath"](around:${radiusM},${lat},${lng});
  way["golf"="path"](around:${radiusM},${lat},${lng});
  relation["golf"="path"](around:${radiusM},${lat},${lng});
  way["natural"="scrub"](around:${radiusM},${lat},${lng});
  relation["natural"="scrub"](around:${radiusM},${lat},${lng});
  way["barrier"="hedge"](around:${radiusM},${lat},${lng});
  relation["barrier"="hedge"](around:${radiusM},${lat},${lng});
  node["natural"="tree"](around:${radiusM},${lat},${lng});
);
out body geom;
`;

  const elements = await runOverpassQuery(query);
  const features: OsmGolfFeature[] = [];

  for (const element of elements) {
    const coords = coordsFromElement(element);
    const center = centroid(coords);
    if (!center) continue;

    const featureType =
      mapGolfTag(element.tags?.golf) ?? mapEnvironmentalFeature(element);
    if (!featureType) continue;

    const geometry = geometryForFeature(featureType, coords);
    if (!geometry) continue;

    const { holeNumber, courseHoleCount } = parseOsmHoleTags(element.tags);

    features.push({
      osmId: `${element.type}/${element.id}`,
      featureType,
      holeNumber,
      courseHoleCount,
      center,
      geometry,
    });
  }

  return features;
}

type LayoutBucketKey = number | "unknown";

function layoutBucketKey(feature: OsmGolfFeature): LayoutBucketKey {
  return feature.courseHoleCount ?? "unknown";
}

function scoreHoleWayLayout(
  holeWays: OsmGolfFeature[],
  holeCount: number
): number {
  const layoutCount =
    holeWays.find((way) => way.courseHoleCount != null)?.courseHoleCount ?? null;
  const holeNumbers = new Set(
    holeWays
      .map((way) => way.holeNumber)
      .filter((holeNumber): holeNumber is number => holeNumber != null)
  );

  let score = 0;
  for (let hole = 1; hole <= holeCount; hole += 1) {
    if (holeNumbers.has(hole)) score += 10;
  }

  if (layoutCount === holeCount) score += 1000;
  if (layoutCount != null && layoutCount !== holeCount) score -= 5000;

  score -= (holeWays.length - holeNumbers.size) * 5;

  return score;
}

function disambiguateUnknownHoleWays(
  holeWays: OsmGolfFeature[],
  holeCount: number
): OsmGolfFeature[] {
  const byNumber = new Map<number, OsmGolfFeature[]>();
  for (const way of holeWays) {
    if (way.holeNumber == null) continue;
    const list = byNumber.get(way.holeNumber) ?? [];
    list.push(way);
    byNumber.set(way.holeNumber, list);
  }

  const anchorWays = holeWays.filter(
    (way) =>
      way.holeNumber != null &&
      way.holeNumber > Math.min(9, holeCount - 1) &&
      way.holeNumber <= holeCount
  );
  const anchorCentroid =
    anchorWays.length > 0
      ? centroid(anchorWays.map((way) => way.center))
      : null;

  const selected: OsmGolfFeature[] = [];
  for (let hole = 1; hole <= holeCount; hole += 1) {
    const candidates = byNumber.get(hole) ?? [];
    if (candidates.length === 0) continue;
    if (candidates.length === 1 || !anchorCentroid) {
      selected.push(candidates[0]!);
      continue;
    }

    let best = candidates[0]!;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const distance = yardsBetween(candidate.center, anchorCentroid);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    selected.push(best);
  }

  return selected;
}

function featureMatchesSelectedLayout(
  feature: OsmGolfFeature,
  selectedLayoutCount: number | null,
  selectedHoleWays: OsmGolfFeature[],
  holeCount: number
): boolean {
  if (feature.holeNumber == null) return true;
  if (feature.holeNumber < 1 || feature.holeNumber > holeCount) return false;

  if (feature.courseHoleCount != null) {
    if (selectedLayoutCount != null) {
      return feature.courseHoleCount === selectedLayoutCount;
    }
    return feature.courseHoleCount === holeCount;
  }

  if (feature.featureType === "hole") {
    return selectedHoleWays.some((way) => way.osmId === feature.osmId);
  }

  return selectedHoleWays.some((way) => way.holeNumber === feature.holeNumber);
}

/**
 * When a facility has multiple layouts (e.g. 18-hole + 9-hole), keep only OSM
 * features that belong to the layout matching `holeCount`.
 */
export function filterOsmFeaturesForHoleCount(
  features: OsmGolfFeature[],
  holeCount: number
): OsmGolfFeature[] {
  const holeWays = features.filter(
    (feature) =>
      feature.featureType === "hole" &&
      feature.holeNumber != null &&
      feature.holeNumber >= 1 &&
      feature.holeNumber <= holeCount
  );

  if (holeWays.length === 0) {
    return features.filter(
      (feature) => feature.holeNumber == null || feature.holeNumber <= holeCount
    );
  }

  const layoutBuckets = new Map<LayoutBucketKey, OsmGolfFeature[]>();
  for (const way of holeWays) {
    const key = layoutBucketKey(way);
    const bucket = layoutBuckets.get(key) ?? [];
    bucket.push(way);
    layoutBuckets.set(key, bucket);
  }

  let bestBucket: OsmGolfFeature[] = holeWays;
  let bestScore = -Infinity;

  for (const bucket of layoutBuckets.values()) {
    const score = scoreHoleWayLayout(bucket, holeCount);
    if (score > bestScore) {
      bestScore = score;
      bestBucket = bucket;
    }
  }

  const selectedLayoutCount =
    bestBucket.find((way) => way.courseHoleCount != null)?.courseHoleCount ?? null;

  const selectedHoleWays =
    selectedLayoutCount == null &&
    bestBucket.length > new Set(bestBucket.map((way) => way.holeNumber)).size
      ? disambiguateUnknownHoleWays(bestBucket, holeCount)
      : bestBucket.filter((way, index, ways) => {
          if (way.holeNumber == null) return false;
          return (
            ways.findIndex((candidate) => candidate.holeNumber === way.holeNumber) ===
            index
          );
        });

  const selectedHoleWayIds = new Set(selectedHoleWays.map((way) => way.osmId));
  const selectedWayByHole = new Map<number, OsmGolfFeature>();
  for (const way of selectedHoleWays) {
    if (way.holeNumber != null) {
      selectedWayByHole.set(way.holeNumber, way);
    }
  }

  const filtered = features.filter((feature) => {
    if (feature.featureType === "hole" && feature.holeNumber != null) {
      return selectedHoleWayIds.has(feature.osmId);
    }

    return featureMatchesSelectedLayout(
      feature,
      selectedLayoutCount,
      selectedHoleWays,
      holeCount
    );
  });

  const ambiguousGroups = new Map<string, OsmGolfFeature[]>();
  const definiteKeep = new Set<string>();

  for (const feature of filtered) {
    if (feature.holeNumber == null || feature.courseHoleCount != null) {
      definiteKeep.add(feature.osmId);
      continue;
    }

    const key = `${feature.featureType}:${feature.holeNumber}`;
    const group = ambiguousGroups.get(key) ?? [];
    group.push(feature);
    ambiguousGroups.set(key, group);
  }

  for (const group of ambiguousGroups.values()) {
    if (group.length === 1) {
      definiteKeep.add(group[0]!.osmId);
      continue;
    }

    const holeNumber = group[0]!.holeNumber!;
    const anchor = selectedWayByHole.get(holeNumber)?.center;
    let best = group[0]!;
    if (anchor) {
      let bestDistance = Infinity;
      for (const feature of group) {
        const distance = yardsBetween(feature.center, anchor);
        if (distance < bestDistance) {
          best = feature;
          bestDistance = distance;
        }
      }
    }
    definiteKeep.add(best.osmId);
  }

  return filtered.filter((feature) => definiteKeep.has(feature.osmId));
}

export type AssignedGreen = {
  center: LatLng;
  geometry: OsmGeometry | null;
  osmId: string;
  source: "overpass_tag" | "overpass_hole_way";
};

export type GreenAssignmentResult = {
  byHole: Record<number, AssignedGreen | null>;
  unassignedGreens: OsmGolfFeature[];
};

function nearestGreen(
  point: LatLng,
  greens: OsmGolfFeature[],
  usedOsmIds: Set<string>,
  maxYards: number
): OsmGolfFeature | null {
  let best: OsmGolfFeature | null = null;
  let bestDistance = Infinity;

  for (const green of greens) {
    if (usedOsmIds.has(green.osmId)) continue;
    const distance = yardsBetween(point, green.center);
    if (distance <= maxYards && distance < bestDistance) {
      best = green;
      bestDistance = distance;
    }
  }

  return best;
}

export function assignGreensToHoles(
  features: OsmGolfFeature[],
  holeNumbers: number[]
): GreenAssignmentResult {
  const greens = features.filter((feature) => feature.featureType === "green");
  const holeWays = features.filter((feature) => feature.featureType === "hole");

  const byHole: Record<number, AssignedGreen | null> = Object.fromEntries(
    holeNumbers.map((hole) => [hole, null])
  );
  const usedGreenIds = new Set<string>();

  for (const green of greens) {
    if (green.holeNumber == null || !holeNumbers.includes(green.holeNumber)) {
      continue;
    }
    if (byHole[green.holeNumber]) continue;

    byHole[green.holeNumber] = {
      center: green.center,
      geometry: green.geometry,
      osmId: green.osmId,
      source: "overpass_tag",
    };
    usedGreenIds.add(green.osmId);
  }

  for (const holeWay of holeWays) {
    if (holeWay.holeNumber == null || !holeNumbers.includes(holeWay.holeNumber)) {
      continue;
    }
    if (byHole[holeWay.holeNumber]) continue;

    const approach =
      holeWay.geometry?.type === "LineString" &&
      holeWay.geometry.coordinates.length > 0
        ? {
            lat: holeWay.geometry.coordinates.at(-1)![1],
            lng: holeWay.geometry.coordinates.at(-1)![0],
          }
        : holeWay.center;

    const green = nearestGreen(approach, greens, usedGreenIds, 400);
    if (!green) continue;

    byHole[holeWay.holeNumber] = {
      center: green.center,
      geometry: green.geometry,
      osmId: green.osmId,
      source: "overpass_hole_way",
    };
    usedGreenIds.add(green.osmId);
  }

  const unassignedGreens = greens.filter((green) => !usedGreenIds.has(green.osmId));

  return { byHole, unassignedGreens };
}
