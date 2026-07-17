import type { LatLng } from "@/lib/green-distance";

export type ElevationGridResult = {
  gridWidth: number;
  gridHeight: number;
  boundsGeoJson: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
  elevationData: number[][];
  slopeData: number[][];
  resolutionM: string;
  source: string;
};

type PolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

function boundsFromPolygon(geometry: PolygonGeometry) {
  const ring = geometry.coordinates[0];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lng, lat] of ring) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  return { minLat, maxLat, minLng, maxLng };
}

function metersPerDegreeLat() {
  return 111_320;
}

function metersPerDegreeLng(lat: number) {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

function computeSlopeGrid(elevations: number[][], cellSizeM: number): number[][] {
  const height = elevations.length;
  const width = elevations[0]?.length ?? 0;
  const slope: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );

  for (let row = 1; row < height - 1; row += 1) {
    for (let col = 1; col < width - 1; col += 1) {
      const dzdx =
        (elevations[row][col + 1] - elevations[row][col - 1]) / (2 * cellSizeM);
      const dzdy =
        (elevations[row - 1][col] - elevations[row + 1][col]) / (2 * cellSizeM);
      slope[row][col] = Math.sqrt(dzdx ** 2 + dzdy ** 2);
    }
  }

  return slope;
}

export async function fetchElevationGridForGreen(
  greenGeometry: PolygonGeometry,
  gridSize = 16
): Promise<ElevationGridResult | null> {
  const bounds = boundsFromPolygon(greenGeometry);
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const latStep = (bounds.maxLat - bounds.minLat) / (gridSize - 1 || 1);
  const lngStep = (bounds.maxLng - bounds.minLng) / (gridSize - 1 || 1);

  const lats: number[] = [];
  const lngs: number[] = [];

  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      lats.push(bounds.minLat + row * latStep);
      lngs.push(bounds.minLng + col * lngStep);
    }
  }

  const params = new URLSearchParams();
  for (const lat of lats) params.append("latitude", String(lat));
  for (const lng of lngs) params.append("longitude", String(lng));

  const response = await fetch(
    `https://api.open-meteo.com/v1/elevation?${params.toString()}`,
    { next: { revalidate: 86400 } }
  );

  if (!response.ok) return null;

  const data = (await response.json()) as { elevation?: number[] };
  if (!data.elevation?.length) return null;

  const elevations: number[][] = [];
  for (let row = 0; row < gridSize; row += 1) {
    elevations.push(data.elevation.slice(row * gridSize, (row + 1) * gridSize));
  }

  const cellSizeM = Math.max(
    latStep * metersPerDegreeLat(),
    lngStep * metersPerDegreeLng(centerLat)
  );

  const slopeData = computeSlopeGrid(elevations, cellSizeM || 1);

  const boundsGeoJson: ElevationGridResult["boundsGeoJson"] = {
    type: "Polygon",
    coordinates: [
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
        [bounds.minLng, bounds.maxLat],
        [bounds.minLng, bounds.minLat],
      ],
    ],
  };

  return {
    gridWidth: gridSize,
    gridHeight: gridSize,
    boundsGeoJson,
    elevationData: elevations,
    slopeData,
    resolutionM: String(Math.round(cellSizeM)),
    source: "open_meteo",
  };
}

export function latLngFromPolygonCentroid(geometry: PolygonGeometry): LatLng {
  const ring = geometry.coordinates[0];
  const sum = ring.reduce(
    (acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: sum.lat / ring.length,
    lng: sum.lng / ring.length,
  };
}
