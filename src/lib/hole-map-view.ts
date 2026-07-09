import type { GeolocationPosition } from "@/hooks/use-geolocation";
import type { GreenTargets } from "@/lib/green-distance";
import { yardsBetween } from "@/lib/green-distance";
import type { GeoJsonFeatureCollection } from "@/lib/geojson";

export type HoleMapBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type HoleMapView = {
  bounds: HoleMapBounds;
  center: Point;
  bearing: number;
  tee: Point | null;
  back: Point | null;
};

type Point = { lat: number; lng: number };

const EDGE_PADDING_YARDS = 35;
const MAX_PLAYER_INCLUDE_YARDS = 700;

type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

type PolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

function collectGeometryPoints(geometry: unknown): Point[] {
  if (!geometry || typeof geometry !== "object") return [];

  const typed = geometry as LineStringGeometry | PolygonGeometry;

  if (typed.type === "Polygon") {
    return typed.coordinates.flatMap((ring) =>
      ring.map(([lng, lat]) => ({ lat, lng }))
    );
  }

  if (typed.type === "LineString") {
    return typed.coordinates.map(([lng, lat]) => ({ lat, lng }));
  }

  return [];
}

function featureByType(features: GeoJsonFeatureCollection, type: string) {
  return features.features.find(
    (feature) => feature.properties?.featureType === type
  );
}

function boundsFromPoints(points: Point[]): HoleMapBounds | null {
  if (points.length === 0) return null;

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

function centroid(points: Point[]): Point {
  const sum = points.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
}

function midpoint(a: Point, b: Point): Point {
  return {
    lat: (a.lat + b.lat) / 2,
    lng: (a.lng + b.lng) / 2,
  };
}

function expandBounds(bounds: HoleMapBounds, paddingYards: number): HoleMapBounds {
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;

  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    111_320 * Math.cos((centerLat * Math.PI) / 180);

  const latPad = (paddingYards * 0.9144) / metersPerDegreeLat;
  const lngPad = (paddingYards * 0.9144) / metersPerDegreeLng;

  return {
    minLat: bounds.minLat - latPad,
    maxLat: bounds.maxLat + latPad,
    minLng: bounds.minLng - lngPad,
    maxLng: bounds.maxLng + lngPad,
  };
}

export function bearingDegrees(from: Point, to: Point): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

function collectHoleExtentPoints(
  features: GeoJsonFeatureCollection,
  targets: GreenTargets | null
): Point[] {
  const points: Point[] = [];

  const holeLine = featureByType(features, "hole_line");
  const green = featureByType(features, "green");

  if (holeLine) {
    points.push(...collectGeometryPoints(holeLine.geometry));
  }

  if (green) {
    points.push(...collectGeometryPoints(green.geometry));
  }

  if (targets) {
    points.push(targets.front, targets.middle, targets.back);
  }

  if (points.length === 0) {
    for (const feature of features.features) {
      points.push(...collectGeometryPoints(feature.geometry));
    }
  }

  return points;
}

function resolveTeePoint(
  features: GeoJsonFeatureCollection,
  targets: GreenTargets | null
): Point | null {
  const holeLine = featureByType(features, "hole_line");
  if (holeLine?.geometry) {
    const line = holeLine.geometry as LineStringGeometry;
    if (line.coordinates.length > 0) {
      const [lng, lat] = line.coordinates[0];
      return { lat, lng };
    }
  }

  const tee = featureByType(features, "tee");
  if (tee?.geometry) {
    const points = collectGeometryPoints(tee.geometry);
    if (points[0]) return points[0];
  }

  if (targets) return targets.front;
  return null;
}

function resolveBackPoint(
  features: GeoJsonFeatureCollection,
  targets: GreenTargets | null,
  tee: Point | null
): Point | null {
  if (targets?.back) return targets.back;

  const green = featureByType(features, "green");
  if (!green?.geometry || !tee) {
    const points = collectHoleExtentPoints(features, targets);
    return points.length > 0 ? centroid(points) : null;
  }

  const greenPoints = collectGeometryPoints(green.geometry);
  if (greenPoints.length === 0) return targets?.middle ?? null;

  let farthest = greenPoints[0];
  let bestDistance = yardsBetween(tee, farthest);

  for (const point of greenPoints) {
    const distance = yardsBetween(tee, point);
    if (distance > bestDistance) {
      farthest = point;
      bestDistance = distance;
    }
  }

  return farthest;
}

export function computeHoleMapView(options: {
  features: GeoJsonFeatureCollection;
  targets: GreenTargets | null;
  playerPosition: GeolocationPosition | null;
}): HoleMapView | null {
  const { features, targets, playerPosition } = options;

  const tee = resolveTeePoint(features, targets);
  const back = resolveBackPoint(features, targets, tee);
  let extentPoints = collectHoleExtentPoints(features, targets);

  if (tee && !extentPoints.some((point) => point.lat === tee.lat && point.lng === tee.lng)) {
    extentPoints.push(tee);
  }
  if (back && !extentPoints.some((point) => point.lat === back.lat && point.lng === back.lng)) {
    extentPoints.push(back);
  }

  const rawBounds = boundsFromPoints(extentPoints);
  if (!rawBounds) return null;

  let bounds = expandBounds(rawBounds, EDGE_PADDING_YARDS);

  if (playerPosition && tee) {
    const playerDistance = yardsBetween(
      { lat: playerPosition.lat, lng: playerPosition.lng },
      tee
    );

    if (playerDistance <= MAX_PLAYER_INCLUDE_YARDS) {
      const withPlayer = boundsFromPoints([
        ...extentPoints,
        { lat: playerPosition.lat, lng: playerPosition.lng },
      ]);
      if (withPlayer) {
        bounds = expandBounds(withPlayer, EDGE_PADDING_YARDS);
      }
    }
  }

  const bearing =
    tee && back ? bearingDegrees(tee, back) : tee && targets?.middle
      ? bearingDegrees(tee, targets.middle)
      : 0;

  const center =
    tee && back
      ? midpoint(tee, back)
      : centroid(extentPoints);

  return {
    bounds,
    center,
    bearing,
    tee,
    back,
  };
}
