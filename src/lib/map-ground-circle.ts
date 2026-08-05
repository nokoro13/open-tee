import type { LatLng } from "@/lib/green-distance";

const EARTH_RADIUS_M = 6_371_000;

/** Lat/lng ring lying on the ground — renders with map tilt/perspective. */
export function circlePolygonPath(
  center: LatLng,
  radiusMeters: number,
  segments = 48
): LatLng[] {
  if (radiusMeters <= 0) return [];

  const latRad = (center.lat * Math.PI) / 180;
  const lngRad = (center.lng * Math.PI) / 180;
  const angularDistance = radiusMeters / EARTH_RADIUS_M;

  return Array.from({ length: segments }, (_, index) => {
    const bearing = (index / segments) * 2 * Math.PI;
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinDist = Math.sin(angularDistance);
    const cosDist = Math.cos(angularDistance);

    const lat2 = Math.asin(
      sinLat * cosDist + cosLat * sinDist * Math.cos(bearing)
    );
    const lng2 =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * sinDist * cosLat,
        cosDist - sinLat * Math.sin(lat2)
      );

    return {
      lat: (lat2 * 180) / Math.PI,
      lng: (lng2 * 180) / Math.PI,
    };
  });
}

export function circlePolygonPathYards(
  center: LatLng,
  radiusYards: number,
  segments = 48
): LatLng[] {
  return circlePolygonPath(center, radiusYards * 0.9144, segments);
}
