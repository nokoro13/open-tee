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

function parseHoleNumber(tags: Record<string, string> | undefined): number | null {
  if (!tags) return null;

  for (const key of ["ref", "golf:hole", "hole"]) {
    const raw = tags[key];
    if (!raw) continue;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 18) {
      return parsed;
    }
  }

  const nameMatch = tags.name?.match(/hole\s*#?\s*(\d{1,2})/i);
  if (nameMatch) {
    const parsed = Number.parseInt(nameMatch[1], 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 18) {
      return parsed;
    }
  }

  return null;
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

    features.push({
      osmId: `${element.type}/${element.id}`,
      featureType,
      holeNumber: parseHoleNumber(element.tags),
      center,
      geometry,
    });
  }

  return features;
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
