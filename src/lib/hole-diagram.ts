import type { GeolocationPosition } from "@/hooks/use-geolocation";
import type { GreenTargets } from "@/lib/green-distance";
import { MIN_LIVE_DISTANCE_YARDS, yardsBetween } from "@/lib/green-distance";
import type { GeoJsonFeatureCollection } from "@/lib/geojson";
import { computeHoleMapView } from "@/lib/hole-map-view";

export type DiagramPoint = { x: number; y: number };

export type DiagramPolygon = {
  kind: "polygon";
  featureType: string;
  points: DiagramPoint[];
};

export type DiagramLine = {
  kind: "line";
  featureType: string;
  points: DiagramPoint[];
};

export type DiagramPointShape = {
  kind: "point";
  featureType: string;
  point: DiagramPoint;
};

export type DiagramShape = DiagramPolygon | DiagramLine | DiagramPointShape;

export type DiagramMarker = {
  x: number;
  y: number;
  label: string;
  stroke: string;
  fill: string;
  radius: number;
  pulse?: boolean;
};

export type HoleDiagramLayout = {
  shapes: DiagramShape[];
  markers: DiagramMarker[];
  hasFairway: boolean;
  holeLinePoints: DiagramPoint[];
  playerPoint: DiagramPoint | null;
  pinPoint: DiagramPoint | null;
  distanceToPin: number | null;
};

type Point = { lat: number; lng: number };

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

const PADDING_X = 28;
const PADDING_TOP = 44;
const PADDING_BOTTOM = 64;
const MAX_PLAYER_INCLUDE_YARDS = 700;

function collectGeometryPoints(geometry: unknown): Point[] {
  if (!geometry || typeof geometry !== "object") return [];

  const typed = geometry as
    | LineStringGeometry
    | PolygonGeometry
    | MultiPolygonGeometry
    | PointGeometry;

  if (typed.type === "Point") {
    const [lng, lat] = typed.coordinates;
    return [{ lat, lng }];
  }

  if (typed.type === "MultiPolygon") {
    return typed.coordinates.flatMap((polygon) =>
      polygon.flatMap((ring) => ring.map(([lng, lat]) => ({ lat, lng })))
    );
  }

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

function projectPoint(
  point: Point,
  origin: Point,
  bearingDegrees: number
): DiagramPoint {
  const meters = latLngToMeters(point, origin);
  return rotateMeters(meters.x, meters.y, bearingDegrees);
}

function boundsFromProjected(points: DiagramPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function toScreenPoint(
  point: DiagramPoint,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  width: number,
  height: number
): DiagramPoint {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const innerWidth = width - PADDING_X * 2;
  const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const scale = Math.min(innerWidth / spanX, innerHeight / spanY);
  const offsetX = (innerWidth - spanX * scale) / 2;
  const offsetY = (innerHeight - spanY * scale) / 2;

  return {
    x: PADDING_X + offsetX + (point.x - bounds.minX) * scale,
    y: height - PADDING_BOTTOM - offsetY - (point.y - bounds.minY) * scale,
  };
}

function addShapeFromGeometry(
  shapes: DiagramShape[],
  featureType: string,
  geometry: unknown,
  toScreen: (point: Point) => DiagramPoint
) {
  if (!geometry || typeof geometry !== "object") return;

  const typed = geometry as
    | LineStringGeometry
    | PolygonGeometry
    | MultiPolygonGeometry
    | PointGeometry;

  if (typed.type === "Point") {
    const [lng, lat] = typed.coordinates;
    shapes.push({
      kind: "point",
      featureType,
      point: toScreen({ lat, lng }),
    });
    return;
  }

  if (typed.type === "MultiPolygon") {
    for (const polygon of typed.coordinates) {
      for (const ring of polygon) {
        shapes.push({
          kind: "polygon",
          featureType,
          points: ring.map(([lng, lat]) => toScreen({ lat, lng })),
        });
      }
    }
    return;
  }

  if (typed.type === "Polygon") {
    for (const ring of typed.coordinates) {
      shapes.push({
        kind: "polygon",
        featureType,
        points: ring.map(([lng, lat]) => toScreen({ lat, lng })),
      });
    }
    return;
  }

  if (typed.type === "LineString") {
    shapes.push({
      kind: "line",
      featureType,
      points: typed.coordinates.map(([lng, lat]) => toScreen({ lat, lng })),
    });
  }
}

export function buildHoleDiagramLayout(options: {
  features: GeoJsonFeatureCollection;
  targets: GreenTargets | null;
  playerPosition: GeolocationPosition | null;
  width: number;
  height: number;
}): HoleDiagramLayout | null {
  const { features, targets, playerPosition, width, height } = options;
  const view = computeHoleMapView({ features, targets, playerPosition });
  if (!view) return null;

  const origin = view.center;
  const bearing = view.bearing;

  const geoPoints: Point[] = [];
  for (const feature of features.features) {
    geoPoints.push(...collectGeometryPoints(feature.geometry));
  }
  if (targets) {
    geoPoints.push(targets.front, targets.middle, targets.back);
  }
  if (view.tee) geoPoints.push(view.tee);

  let includePlayer = false;
  if (playerPosition && view.tee) {
    const playerDistance = yardsBetween(
      { lat: playerPosition.lat, lng: playerPosition.lng },
      view.tee
    );
    includePlayer = playerDistance <= MAX_PLAYER_INCLUDE_YARDS;
    if (includePlayer) {
      geoPoints.push({ lat: playerPosition.lat, lng: playerPosition.lng });
    }
  }

  if (geoPoints.length === 0) return null;

  const bounds = boundsFromProjected(
    geoPoints.map((point) => projectPoint(point, origin, bearing))
  );

  const toScreen = (point: Point): DiagramPoint =>
    toScreenPoint(projectPoint(point, origin, bearing), bounds, width, height);

  const shapes: DiagramShape[] = [];
  let hasFairway = false;
  let holeLinePoints: DiagramPoint[] = [];

  for (const feature of features.features) {
    const featureType = String(feature.properties?.featureType ?? "other");
    if (featureType === "fairway") hasFairway = true;

    addShapeFromGeometry(shapes, featureType, feature.geometry, toScreen);

    if (featureType === "hole_line" && feature.geometry) {
      const geometry = feature.geometry as LineStringGeometry;
      if (geometry.type === "LineString") {
        holeLinePoints = geometry.coordinates.map(([lng, lat]) =>
          toScreen({ lat, lng })
        );
      }
    }
  }

  const markers: DiagramMarker[] = [];

  if (view.tee) {
    const tee = toScreen(view.tee);
    markers.push({
      x: tee.x,
      y: tee.y,
      label: "T",
      stroke: "#ffffff",
      fill: "#1d4ed8",
      radius: 9,
    });
  }

  if (targets) {
    const front = toScreen(targets.front);
    const middle = toScreen(targets.middle);
    const back = toScreen(targets.back);

    markers.push(
      {
        x: front.x,
        y: front.y,
        label: "F",
        stroke: "#ffffff",
        fill: "#fbbf24",
        radius: 8,
      },
      {
        x: middle.x,
        y: middle.y,
        label: "M",
        stroke: "#ffffff",
        fill: "#f59e0b",
        radius: 8,
      },
      {
        x: back.x,
        y: back.y,
        label: "B",
        stroke: "#ffffff",
        fill: "#d97706",
        radius: 8,
      }
    );
  }

  let playerPoint: DiagramPoint | null = null;
  let pinPoint: DiagramPoint | null = null;
  let distanceToPin: number | null = null;

  if (targets) {
    pinPoint = toScreen(targets.middle);
  }

  if (includePlayer && playerPosition) {
    playerPoint = toScreen({
      lat: playerPosition.lat,
      lng: playerPosition.lng,
    });
    if (targets) {
      distanceToPin = Math.round(
        yardsBetween(
          { lat: playerPosition.lat, lng: playerPosition.lng },
          targets.middle
        )
      );
    }
  }

  if (includePlayer && playerPosition && playerPoint) {
    markers.push({
      x: playerPoint.x,
      y: playerPoint.y,
      label: "",
      stroke: "#ffffff",
      fill: "#3b82f6",
      radius: 10,
      pulse: true,
    });
  }

  return {
    shapes,
    markers,
    hasFairway,
    holeLinePoints,
    playerPoint,
    pinPoint,
    distanceToPin,
  };
}

export function drawHoleDiagram(
  ctx: CanvasRenderingContext2D,
  layout: HoleDiagramLayout,
  width: number,
  height: number,
  pulsePhase = 0
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#2a5538");
  gradient.addColorStop(0.45, "#234a31");
  gradient.addColorStop(1, "#1a3828");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawSubtleGrid(ctx, width, height);

  const drawOrder = [
    "rough",
    "scrub",
    "water",
    "fairway",
    "bunker",
    "cartpath",
    "out_of_bounds",
    "tee",
    "hole_line",
    "green",
    "tree",
    "other",
  ];

  if (!layout.hasFairway && layout.holeLinePoints.length >= 2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(layout.holeLinePoints[0]!.x, layout.holeLinePoints[0]!.y);
    for (let index = 1; index < layout.holeLinePoints.length; index += 1) {
      ctx.lineTo(layout.holeLinePoints[index]!.x, layout.holeLinePoints[index]!.y);
    }
    ctx.strokeStyle = "rgba(96, 168, 108, 0.55)";
    ctx.lineWidth = 36;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  for (const featureType of drawOrder) {
    for (const shape of layout.shapes) {
      if (shape.featureType !== featureType) continue;
      drawShape(ctx, shape);
    }
  }

  for (const shape of layout.shapes) {
    if (drawOrder.includes(shape.featureType)) continue;
    drawShape(ctx, shape);
  }

  if (
    layout.playerPoint &&
    layout.pinPoint &&
    layout.distanceToPin != null &&
    layout.distanceToPin > MIN_LIVE_DISTANCE_YARDS
  ) {
    drawPlayerDistanceLine(
      ctx,
      layout.playerPoint,
      layout.pinPoint,
      layout.distanceToPin
    );
  }

  for (const marker of layout.markers) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    if (marker.pulse) {
      const pulseRadius = marker.radius + 5 + Math.sin(pulsePhase) * 4;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, pulseRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(96, 165, 250, 0.22)";
      ctx.shadowBlur = 0;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(marker.x, marker.y, marker.radius, 0, Math.PI * 2);
    ctx.fillStyle = marker.fill;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = marker.stroke;
    ctx.stroke();
    ctx.restore();

    if (marker.label) {
      ctx.fillStyle = marker.label === "T" ? "#ffffff" : "#111827";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(marker.label, marker.x, marker.y);
    }
  }

  drawVignette(ctx, width, height);
}

function drawSubtleGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const spacing = 32;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;

  for (let x = spacing; x < width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = spacing; y < height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.25,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.35)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function drawPlayerDistanceLine(
  ctx: CanvasRenderingContext2D,
  from: DiagramPoint,
  to: DiagramPoint,
  yards: number
) {
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(147, 197, 253, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const label = `${yards}`;
  ctx.font = "bold 13px system-ui, sans-serif";
  const valueWidth = ctx.measureText(label).width;
  ctx.font = "600 11px system-ui, sans-serif";
  const suffixWidth = ctx.measureText("y").width;
  const labelWidth = valueWidth + suffixWidth + 24;
  const labelHeight = 26;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - 14;

  ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
  roundRect(ctx, midX - labelWidth / 2, midY - labelHeight / 2, labelWidth, labelHeight, 13);
  ctx.fill();

  ctx.strokeStyle = "rgba(147, 197, 253, 0.5)";
  ctx.lineWidth = 1;
  roundRect(ctx, midX - labelWidth / 2, midY - labelHeight / 2, labelWidth, labelHeight, 13);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  const textX = midX - labelWidth / 2 + 11;
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.fillText(label, textX, midY);
  ctx.fillStyle = "rgba(191, 219, 254, 0.85)";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText("y", textX + valueWidth + 2, midY + 1);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: DiagramShape) {
  if (shape.kind === "point") {
    drawPointShape(ctx, shape);
    return;
  }

  if (shape.points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(shape.points[0]!.x, shape.points[0]!.y);
  for (let index = 1; index < shape.points.length; index += 1) {
    ctx.lineTo(shape.points[index]!.x, shape.points[index]!.y);
  }

  if (shape.kind === "polygon") {
    ctx.closePath();
  }

  switch (shape.featureType) {
    case "green":
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "rgba(74, 222, 128, 0.92)";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#15803d";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      break;
    case "fairway":
      ctx.fillStyle = "rgba(82, 156, 95, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "#3d7a4d";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    case "bunker":
      ctx.fillStyle = "rgba(234, 196, 136, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "#b8864f";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    case "water":
      ctx.fillStyle = "rgba(56, 189, 248, 0.78)";
      ctx.fill();
      ctx.strokeStyle = "#0369a1";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    case "hole_line":
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.stroke();
      break;
    case "tee":
      ctx.fillStyle = "rgba(59, 130, 246, 0.45)";
      ctx.fill();
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    case "rough":
      ctx.fillStyle = "rgba(45, 90, 55, 0.72)";
      ctx.fill();
      ctx.strokeStyle = "#2f5238";
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case "scrub":
      ctx.fillStyle = "rgba(74, 103, 65, 0.78)";
      ctx.fill();
      ctx.strokeStyle = "#4d6b42";
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case "out_of_bounds":
      ctx.strokeStyle = "rgba(248, 113, 113, 0.9)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    case "cartpath":
      ctx.strokeStyle = "rgba(203, 213, 225, 0.85)";
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    default:
      ctx.fillStyle = "rgba(120, 145, 110, 0.35)";
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.stroke();
  }
}

function drawPointShape(ctx: CanvasRenderingContext2D, shape: DiagramPointShape) {
  if (shape.featureType !== "tree") return;

  const { x, y } = shape.point;
  ctx.save();
  ctx.fillStyle = "rgba(34, 84, 48, 0.95)";
  ctx.strokeStyle = "rgba(187, 247, 208, 0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 3, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(74, 222, 128, 0.75)";
  ctx.fill();
  ctx.restore();
}
