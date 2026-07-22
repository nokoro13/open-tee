import type { GeolocationPosition } from "@/hooks/use-geolocation";
import {
  parseManualHoleLineOsmId,
  parseManualTeeOsmId,
} from "@/lib/course-tees";
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
  /** Back tee used to orient/fit the full hole vertically (tee bottom, green top). */
  orientationTee: Point | null;
  green: Point | null;
  back: Point | null;
  extentPoints: Point[];
};

export type Point = { lat: number; lng: number };

export type HoleMapCameraPadding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type HoleMapCamera = {
  center: Point;
  zoom: number;
  heading: number;
};

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

function featureOsmId(feature: GeoJsonFeatureCollection["features"][number]) {
  const osmId = feature.properties?.osmId;
  return typeof osmId === "string" ? osmId : null;
}

function teeFeatureForKey(
  features: GeoJsonFeatureCollection,
  teeKey: string
) {
  return features.features.find((feature) => {
    if (feature.properties?.featureType !== "tee") return false;
    return parseManualTeeOsmId(featureOsmId(feature))?.teeKey === teeKey;
  });
}

function holeLineForTeeKey(
  features: GeoJsonFeatureCollection,
  teeKey: string
) {
  return features.features.find((feature) => {
    if (feature.properties?.featureType !== "hole_line") return false;
    return parseManualHoleLineOsmId(featureOsmId(feature))?.teeKey === teeKey;
  });
}

function pointFromFeatureGeometry(geometry: unknown): Point | null {
  const points = collectGeometryPoints(geometry);
  return points[0] ?? null;
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

function latLngToMeters(point: Point, origin: Point) {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    111_320 * Math.cos((origin.lat * Math.PI) / 180);

  return {
    x: (point.lng - origin.lng) * metersPerDegreeLng,
    y: (point.lat - origin.lat) * metersPerDegreeLat,
  };
}

function rotateMeters(x: number, y: number, bearingDegrees: number) {
  const theta = (bearingDegrees * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
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
  targets: GreenTargets | null,
  preferredTeeKey?: string | null
): Point[] {
  const points: Point[] = [];

  const holeLine =
    (preferredTeeKey ? holeLineForTeeKey(features, preferredTeeKey) : null) ??
    featureByType(features, "hole_line");
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
  targets: GreenTargets | null,
  preferredTeeKey?: string | null
): Point | null {
  if (preferredTeeKey) {
    const preferredTee = teeFeatureForKey(features, preferredTeeKey);
    if (preferredTee?.geometry) {
      const point = pointFromFeatureGeometry(preferredTee.geometry);
      if (point) return point;
    }

    const preferredLine = holeLineForTeeKey(features, preferredTeeKey);
    if (preferredLine?.geometry) {
      const line = preferredLine.geometry as LineStringGeometry;
      if (line.coordinates.length > 0) {
        const [lng, lat] = line.coordinates[0]!;
        return { lat, lng };
      }
    }
  }

  const holeLine = featureByType(features, "hole_line");
  if (holeLine?.geometry) {
    const line = holeLine.geometry as LineStringGeometry;
    if (line.coordinates.length > 0) {
      const [lng, lat] = line.coordinates[0]!;
      return { lat, lng };
    }
  }

  const tee = featureByType(features, "tee");
  if (tee?.geometry) {
    const point = pointFromFeatureGeometry(tee.geometry);
    if (point) return point;
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

function resolveGreenPoint(
  features: GeoJsonFeatureCollection,
  targets: GreenTargets | null,
  back: Point | null
): Point | null {
  if (targets?.middle) return targets.middle;
  if (back) return back;

  const green = featureByType(features, "green");
  if (green?.geometry) {
    const points = collectGeometryPoints(green.geometry);
    if (points.length > 0) return centroid(points);
  }

  return null;
}

function resolveOrientationTee(
  features: GeoJsonFeatureCollection,
  green: Point | null,
  preferredTeeKey?: string | null
): Point | null {
  const teePoints: Point[] = [];

  for (const feature of features.features) {
    if (feature.properties?.featureType !== "tee") continue;
    const point = pointFromFeatureGeometry(feature.geometry);
    if (point) teePoints.push(point);
  }

  if (green && teePoints.length > 0) {
    return teePoints.reduce((farthest, current) =>
      yardsBetween(current, green) > yardsBetween(farthest, green)
        ? current
        : farthest
    );
  }

  return resolveTeePoint(features, null, preferredTeeKey);
}

function shiftPointByBearing(
  point: Point,
  bearingDeg: number,
  meters: number
): Point {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    111_320 * Math.cos((point.lat * Math.PI) / 180);
  const rad = (bearingDeg * Math.PI) / 180;

  return {
    lat: point.lat + (meters * Math.cos(rad)) / metersPerDegreeLat,
    lng: point.lng + (meters * Math.sin(rad)) / metersPerDegreeLng,
  };
}

function resolveHoleBearing(
  features: GeoJsonFeatureCollection,
  tee: Point | null,
  green: Point | null,
  preferredTeeKey?: string | null
): number {
  if (tee && green) {
    return bearingDegrees(tee, green);
  }

  const holeLine =
    (preferredTeeKey ? holeLineForTeeKey(features, preferredTeeKey) : null) ??
    featureByType(features, "hole_line");

  if (holeLine?.geometry) {
    const line = holeLine.geometry as LineStringGeometry;
    if (line.coordinates.length >= 2) {
      const [startLng, startLat] = line.coordinates[0]!;
      const [endLng, endLat] = line.coordinates[line.coordinates.length - 1]!;
      const start = { lat: startLat, lng: startLng };
      const end = { lat: endLat, lng: endLng };

      if (tee) {
        const startToTee = yardsBetween(start, tee);
        const endToTee = yardsBetween(end, tee);
        return startToTee <= endToTee
          ? bearingDegrees(start, end)
          : bearingDegrees(end, start);
      }

      if (green) {
        const startToGreen = yardsBetween(start, green);
        const endToGreen = yardsBetween(end, green);
        return endToGreen <= startToGreen
          ? bearingDegrees(start, end)
          : bearingDegrees(end, start);
      }

      return bearingDegrees(start, end);
    }
  }

  return 0;
}

export function computeHoleMapCamera(options: {
  view: HoleMapView;
  mapWidth: number;
  mapHeight: number;
  padding: HoleMapCameraPadding;
}): HoleMapCamera {
  const { view, mapWidth, mapHeight, padding } = options;
  const { tee, green, orientationTee, bearing, extentPoints } = view;

  const axisTee = orientationTee ?? tee;
  const center =
    axisTee && green ? midpoint(axisTee, green) : view.center;

  const points =
    extentPoints.length > 0
      ? extentPoints
      : tee && green
        ? [tee, green]
        : [center];

  const projected = points.map((point) => {
    const meters = latLngToMeters(point, center);
    return rotateMeters(meters.x, meters.y, bearing);
  });

  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);

  const padMeters = EDGE_PADDING_YARDS * 0.9144;
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs) + padMeters * 2, 20);
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys) + padMeters * 2, 20);

  const innerWidth = Math.max(mapWidth - padding.left - padding.right, 1);
  const innerHeight = Math.max(mapHeight - padding.top - padding.bottom, 1);

  const metersPerPixelAtZoom0 =
    156_543.03392 * Math.cos((center.lat * Math.PI) / 180);

  const zoomX = Math.log2((innerWidth * metersPerPixelAtZoom0) / spanX);
  const zoomY = Math.log2((innerHeight * metersPerPixelAtZoom0) / spanY);
  const zoom = Math.max(Math.min(zoomX, zoomY, 21), 14);

  const metersPerPixel = metersPerPixelAtZoom0 / 2 ** zoom;
  const padShiftPx = (padding.top - padding.bottom) / 2;
  let adjustedCenter = center;

  if (axisTee && green && padShiftPx !== 0) {
    adjustedCenter = shiftPointByBearing(
      center,
      (bearing + 180) % 360,
      padShiftPx * metersPerPixel
    );
  }

  return {
    center: adjustedCenter,
    zoom,
    heading: bearing,
  };
}

export function computeHoleMapView(options: {
  features: GeoJsonFeatureCollection;
  targets: GreenTargets | null;
  playerPosition: GeolocationPosition | null;
  preferredTeeKey?: string | null;
  /** When true, expand bounds to include the player even if far from the mapped tee. */
  usePlayerAsAnchor?: boolean;
}): HoleMapView | null {
  const {
    features,
    targets,
    playerPosition,
    preferredTeeKey = null,
    usePlayerAsAnchor = false,
  } = options;

  const tee = resolveTeePoint(features, targets, preferredTeeKey);
  const back = resolveBackPoint(features, targets, tee);
  let extentPoints = collectHoleExtentPoints(
    features,
    targets,
    preferredTeeKey
  );

  if (tee && !extentPoints.some((point) => point.lat === tee.lat && point.lng === tee.lng)) {
    extentPoints.push(tee);
  }
  if (back && !extentPoints.some((point) => point.lat === back.lat && point.lng === back.lng)) {
    extentPoints.push(back);
  }

  const rawBounds = boundsFromPoints(extentPoints);
  if (!rawBounds) return null;

  let bounds = expandBounds(rawBounds, EDGE_PADDING_YARDS);

  if (playerPosition && (usePlayerAsAnchor || tee)) {
    const includePlayer =
      usePlayerAsAnchor ||
      (tee != null &&
        yardsBetween(
          { lat: playerPosition.lat, lng: playerPosition.lng },
          tee
        ) <= MAX_PLAYER_INCLUDE_YARDS);

    if (includePlayer) {
      const withPlayer = boundsFromPoints([
        ...extentPoints,
        { lat: playerPosition.lat, lng: playerPosition.lng },
      ]);
      if (withPlayer) {
        bounds = expandBounds(withPlayer, EDGE_PADDING_YARDS);
      }
    }
  }

  const green = resolveGreenPoint(features, targets, back);
  const orientationTee = resolveOrientationTee(features, green, preferredTeeKey);
  const bearing = resolveHoleBearing(
    features,
    orientationTee,
    green,
    preferredTeeKey
  );

  const center =
    orientationTee && green
      ? midpoint(orientationTee, green)
      : tee && green
        ? midpoint(tee, green)
        : tee && back
          ? midpoint(tee, back)
          : centroid(extentPoints);

  return {
    bounds,
    center,
    bearing,
    tee,
    orientationTee,
    green,
    back,
    extentPoints,
  };
}
