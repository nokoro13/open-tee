import type { GreenTargets } from "@/lib/green-distance";

export type PuttingMapBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type PuttingMapData = {
  gridWidth: number;
  gridHeight: number;
  elevation: number[][];
  slope: number[][];
  bounds: PuttingMapBounds;
};

type CanvasPoint = { x: number; y: number };

const PADDING = 28;

function boundsFromRing(ring: [number, number][]): PuttingMapBounds {
  const lats = ring.map(([, lat]) => lat);
  const lngs = ring.map(([lng]) => lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

function resolveDrawBounds(
  data: PuttingMapData,
  greenRing: [number, number][] | null
): PuttingMapBounds {
  if (greenRing && greenRing.length >= 3) {
    return boundsFromRing(greenRing);
  }
  return data.bounds;
}

function geoToCanvas(
  lat: number,
  lng: number,
  bounds: PuttingMapBounds,
  width: number,
  height: number
): CanvasPoint {
  const spanLat = Math.max(bounds.maxLat - bounds.minLat, 1e-9);
  const spanLng = Math.max(bounds.maxLng - bounds.minLng, 1e-9);
  const innerWidth = width - PADDING * 2;
  const innerHeight = height - PADDING * 2;
  const scale = Math.min(innerWidth / spanLng, innerHeight / spanLat);
  const offsetX = (innerWidth - spanLng * scale) / 2;
  const offsetY = (innerHeight - spanLat * scale) / 2;

  return {
    x: PADDING + offsetX + (lng - bounds.minLng) * scale,
    y: height - PADDING - offsetY - (lat - bounds.minLat) * scale,
  };
}

function elevationColor(elevation: number, min: number, max: number) {
  const span = Math.max(max - min, 0.01);
  const t = (elevation - min) / span;
  const r = Math.round(40 + t * 80);
  const g = Math.round(120 + t * 100);
  const b = Math.round(70 + (1 - t) * 60);
  return `rgb(${r}, ${g}, ${b})`;
}

function steepnessOverlay(slope: number, maxSlope: number) {
  const t = Math.min(slope / Math.max(maxSlope, 0.001), 1);
  return `rgba(255, 200, 80, ${t * 0.35})`;
}

function buildGreenPath(
  ctx: CanvasRenderingContext2D,
  greenRing: [number, number][],
  bounds: PuttingMapBounds,
  width: number,
  height: number
) {
  ctx.beginPath();
  for (let index = 0; index < greenRing.length; index += 1) {
    const [lng, lat] = greenRing[index]!;
    const point = geoToCanvas(lat, lng, bounds, width, height);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

export function drawPuttingGreenMap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: PuttingMapData,
  greenRing: [number, number][] | null,
  targets: GreenTargets | null
) {
  const drawBounds = resolveDrawBounds(data, greenRing);
  const flatElevation = data.elevation.flat();
  const minElev = Math.min(...flatElevation);
  const maxElev = Math.max(...flatElevation);
  const flatSlope = data.slope.flat();
  const maxSlope = Math.max(...flatSlope, 0.001);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#1a3828");
  gradient.addColorStop(1, "#122418");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();

  if (greenRing && greenRing.length >= 3) {
    buildGreenPath(ctx, greenRing, drawBounds, width, height);
    ctx.clip();
  }

  const latStep =
    data.gridHeight > 1
      ? (data.bounds.maxLat - data.bounds.minLat) / (data.gridHeight - 1)
      : 0;
  const lngStep =
    data.gridWidth > 1
      ? (data.bounds.maxLng - data.bounds.minLng) / (data.gridWidth - 1)
      : 0;

  for (let row = 0; row < data.gridHeight; row += 1) {
    for (let col = 0; col < data.gridWidth; col += 1) {
      const lat = data.bounds.minLat + row * latStep;
      const lng = data.bounds.minLng + col * lngStep;
      const topLeft = geoToCanvas(lat - latStep / 2, lng - lngStep / 2, drawBounds, width, height);
      const bottomRight = geoToCanvas(lat + latStep / 2, lng + lngStep / 2, drawBounds, width, height);
      const cellWidth = Math.abs(bottomRight.x - topLeft.x);
      const cellHeight = Math.abs(bottomRight.y - topLeft.y);

      const elevation = data.elevation[row]?.[col] ?? minElev;
      const slope = data.slope[row]?.[col] ?? 0;

      ctx.fillStyle = elevationColor(elevation, minElev, maxElev);
      ctx.fillRect(
        Math.min(topLeft.x, bottomRight.x),
        Math.min(topLeft.y, bottomRight.y),
        Math.max(cellWidth, 1),
        Math.max(cellHeight, 1)
      );

      ctx.fillStyle = steepnessOverlay(slope, maxSlope);
      ctx.fillRect(
        Math.min(topLeft.x, bottomRight.x),
        Math.min(topLeft.y, bottomRight.y),
        Math.max(cellWidth, 1),
        Math.max(cellHeight, 1)
      );
    }
  }

  drawContourLines(ctx, data, drawBounds, width, height, minElev, maxElev);
  drawBreakArrows(ctx, data, drawBounds, width, height);

  ctx.restore();

  if (greenRing && greenRing.length >= 3) {
    buildGreenPath(ctx, greenRing, drawBounds, width, height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (targets) {
    drawTargetMarker(ctx, targets.front, drawBounds, width, height, "F", "#fbbf24");
    drawTargetMarker(ctx, targets.middle, drawBounds, width, height, "•", "#ffffff", true);
    drawTargetMarker(ctx, targets.back, drawBounds, width, height, "B", "#d97706");
  }
}

function drawContourLines(
  ctx: CanvasRenderingContext2D,
  data: PuttingMapData,
  bounds: PuttingMapBounds,
  width: number,
  height: number,
  minElev: number,
  maxElev: number
) {
  const levels = 5;
  const span = Math.max(maxElev - minElev, 0.01);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;

  for (let levelIndex = 1; levelIndex < levels; levelIndex += 1) {
    const level = minElev + (span * levelIndex) / levels;

    for (let row = 0; row < data.gridHeight - 1; row += 1) {
      for (let col = 0; col < data.gridWidth - 1; col += 1) {
        const latStep =
          (data.bounds.maxLat - data.bounds.minLat) / (data.gridHeight - 1 || 1);
        const lngStep =
          (data.bounds.maxLng - data.bounds.minLng) / (data.gridWidth - 1 || 1);

        const corners = [
          {
            lat: data.bounds.minLat + row * latStep,
            lng: data.bounds.minLng + col * lngStep,
            elev: data.elevation[row]?.[col] ?? 0,
          },
          {
            lat: data.bounds.minLat + row * latStep,
            lng: data.bounds.minLng + (col + 1) * lngStep,
            elev: data.elevation[row]?.[col + 1] ?? 0,
          },
          {
            lat: data.bounds.minLat + (row + 1) * latStep,
            lng: data.bounds.minLng + (col + 1) * lngStep,
            elev: data.elevation[row + 1]?.[col + 1] ?? 0,
          },
          {
            lat: data.bounds.minLat + (row + 1) * latStep,
            lng: data.bounds.minLng + col * lngStep,
            elev: data.elevation[row + 1]?.[col] ?? 0,
          },
        ];

        const edges = [
          [corners[0], corners[1]],
          [corners[1], corners[2]],
          [corners[2], corners[3]],
          [corners[3], corners[0]],
        ] as const;

        for (const [start, end] of edges) {
          const crosses =
            (start.elev <= level && end.elev > level) ||
            (start.elev > level && end.elev <= level);
          if (!crosses || start.elev === end.elev) continue;

          const t = (level - start.elev) / (end.elev - start.elev);
          const lat = start.lat + (end.lat - start.lat) * t;
          const lng = start.lng + (end.lng - start.lng) * t;
          const point = geoToCanvas(lat, lng, bounds, width, height);

          ctx.beginPath();
          ctx.arc(point.x, point.y, 0.6, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
          ctx.fill();
        }
      }
    }
  }
}

function drawBreakArrows(
  ctx: CanvasRenderingContext2D,
  data: PuttingMapData,
  bounds: PuttingMapBounds,
  width: number,
  height: number
) {
  const latStep =
    data.gridHeight > 1
      ? (data.bounds.maxLat - data.bounds.minLat) / (data.gridHeight - 1)
      : 1;
  const lngStep =
    data.gridWidth > 1
      ? (data.bounds.maxLng - data.bounds.minLng) / (data.gridWidth - 1)
      : 1;

  const step = Math.max(2, Math.floor(Math.min(data.gridWidth, data.gridHeight) / 5));

  for (let row = step; row < data.gridHeight - step; row += step) {
    for (let col = step; col < data.gridWidth - step; col += step) {
      const slope = data.slope[row]?.[col] ?? 0;
      if (slope < 0.008) continue;

      const dElevDcol =
        ((data.elevation[row]?.[col + 1] ?? 0) - (data.elevation[row]?.[col - 1] ?? 0)) / 2;
      const dElevDrow =
        ((data.elevation[row + 1]?.[col] ?? 0) - (data.elevation[row - 1]?.[col] ?? 0)) / 2;

      const downhillX = -dElevDcol;
      const downhillY = dElevDrow;
      const magnitude = Math.hypot(downhillX, downhillY);
      if (magnitude <= 0) continue;

      const lat = data.bounds.minLat + row * latStep;
      const lng = data.bounds.minLng + col * lngStep;
      const origin = geoToCanvas(lat, lng, bounds, width, height);
      const arrowLength = 10 + Math.min(slope * 120, 14);
      const unitX = downhillX / magnitude;
      const unitY = downhillY / magnitude;

      const endX = origin.x + unitX * arrowLength;
      const endY = origin.y - unitY * arrowLength;

      ctx.strokeStyle = "rgba(191, 219, 254, 0.85)";
      ctx.fillStyle = "rgba(191, 219, 254, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      const headAngle = Math.atan2(origin.y - endY, endX - origin.x);
      const headSize = 4;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headSize * Math.cos(headAngle - Math.PI / 6),
        endY + headSize * Math.sin(headAngle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - headSize * Math.cos(headAngle + Math.PI / 6),
        endY + headSize * Math.sin(headAngle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawTargetMarker(
  ctx: CanvasRenderingContext2D,
  point: { lat: number; lng: number },
  bounds: PuttingMapBounds,
  width: number,
  height: number,
  label: string,
  color: string,
  isPin = false
) {
  const canvasPoint = geoToCanvas(point.lat, point.lng, bounds, width, height);
  const radius = isPin ? 7 : 6;

  ctx.beginPath();
  ctx.arc(canvasPoint.x, canvasPoint.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = isPin ? "#ffffff" : color;
  ctx.fill();
  ctx.strokeStyle = isPin ? "#111827" : "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (isPin) {
    ctx.beginPath();
    ctx.arc(canvasPoint.x, canvasPoint.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#111827";
    ctx.fill();
    return;
  }

  ctx.fillStyle = label === "F" || label === "B" ? "#111827" : "#ffffff";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvasPoint.x, canvasPoint.y);
}

export function extractGreenRing(
  features: { features: Array<{ properties?: Record<string, unknown>; geometry: unknown }> } | null
): [number, number][] | null {
  if (!features) return null;

  const green = features.features.find(
    (feature) => feature.properties?.featureType === "green"
  );
  if (!green?.geometry || typeof green.geometry !== "object") return null;

  const geometry = green.geometry as { type?: string; coordinates?: [number, number][][] };
  if (geometry.type !== "Polygon" || !geometry.coordinates?.[0]) return null;

  return geometry.coordinates[0];
}

export function boundsFromGeoJson(
  boundsGeoJson: { coordinates?: [number, number][][] } | null | undefined
): PuttingMapBounds | null {
  const ring = boundsGeoJson?.coordinates?.[0];
  if (!ring?.length) return null;
  return boundsFromRing(ring);
}
