import { yardsBetween, type GreenTargets, type LatLng } from "@/lib/green-distance";

type PolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

function ringToLatLng(ring: [number, number][]): LatLng[] {
  return ring.map(([lng, lat]) => ({ lat, lng }));
}

function teePointFromHoleLine(
  holeLine: LineStringGeometry | null
): LatLng | null {
  if (!holeLine?.coordinates.length) return null;
  const [lng, lat] = holeLine.coordinates[0];
  return { lat, lng };
}

function closestPointOnRing(
  ring: LatLng[],
  reference: LatLng
): { point: LatLng; distance: number } {
  let bestPoint = ring[0];
  let bestDistance = yardsBetween(reference, ring[0]);

  for (let index = 0; index < ring.length - 1; index += 1) {
    const start = ring[index];
    const end = ring[index + 1];

    for (let t = 0; t <= 1; t += 0.05) {
      const point = {
        lat: start.lat + (end.lat - start.lat) * t,
        lng: start.lng + (end.lng - start.lng) * t,
      };
      const distance = yardsBetween(reference, point);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPoint = point;
      }
    }
  }

  return { point: bestPoint, distance: bestDistance };
}

function farthestPointOnRing(ring: LatLng[], reference: LatLng): LatLng {
  let bestPoint = ring[0];
  let bestDistance = yardsBetween(reference, ring[0]);

  for (const point of ring) {
    const distance = yardsBetween(reference, point);
    if (distance > bestDistance) {
      bestDistance = distance;
      bestPoint = point;
    }
  }

  return bestPoint;
}

function centroid(ring: LatLng[]): LatLng {
  const sum = ring.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / ring.length, lng: sum.lng / ring.length };
}

export function computeGreenTargets(options: {
  greenGeometry: PolygonGeometry | null;
  holeLineGeometry?: LineStringGeometry | null;
}): GreenTargets | null {
  const ring = options.greenGeometry?.coordinates[0];
  if (!ring || ring.length < 3) return null;

  const polygon = ringToLatLng(ring);
  const tee = teePointFromHoleLine(options.holeLineGeometry ?? null);
  const reference = tee ?? polygon[0];

  const front = closestPointOnRing(polygon, reference).point;
  const back = farthestPointOnRing(polygon, reference);
  const middle = centroid(polygon);

  return { front, middle, back };
}
