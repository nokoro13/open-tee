import { bearingDegrees } from "@/lib/hole-map-view";
import type { LatLng } from "@/lib/green-distance";
import { yardsBetween } from "@/lib/green-distance";
import type { GeoJsonFeatureCollection } from "@/lib/geojson";

type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

export type HoleDistanceGuide = {
  from: LatLng;
  to: LatLng;
  holeLinePath: LatLng[];
  fromKind: "player" | "tee";
};

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return {
    lat: (a.lat + b.lat) / 2,
    lng: (a.lng + b.lng) / 2,
  };
}

export function extractHoleLinePath(
  features: GeoJsonFeatureCollection
): LatLng[] {
  const holeLine = features.features.find(
    (feature) => feature.properties?.featureType === "hole_line"
  );
  if (!holeLine?.geometry) return [];

  const geometry = holeLine.geometry as LineStringGeometry;
  if (geometry.type !== "LineString") return [];

  return geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

function angleDeviation(a: LatLng, b: LatLng, c: LatLng): number {
  const bearing1 = bearingDegrees(a, b);
  const bearing2 = bearingDegrees(b, c);
  let diff = Math.abs(bearing2 - bearing1);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

export function resolveInitialBreakPoint(
  holeLinePath: LatLng[],
  from: LatLng,
  to: LatLng
): LatLng {
  if (holeLinePath.length >= 3) {
    let bestIndex = 1;
    let bestDeviation = -1;

    for (let index = 1; index < holeLinePath.length - 1; index += 1) {
      const deviation = angleDeviation(
        holeLinePath[index - 1]!,
        holeLinePath[index]!,
        holeLinePath[index + 1]!
      );
      if (deviation > bestDeviation) {
        bestDeviation = deviation;
        bestIndex = index;
      }
    }

    return holeLinePath[bestIndex]!;
  }

  if (holeLinePath.length === 2) {
    return midpoint(holeLinePath[0]!, holeLinePath[1]!);
  }

  return midpoint(from, to);
}

export function segmentYards(from: LatLng, to: LatLng): number {
  return Math.round(yardsBetween(from, to));
}

export function measureHolePathYardage(
  from: LatLng,
  breakPoint: LatLng,
  to: LatLng
): { leg1: number; leg2: number; total: number } {
  const leg1 = segmentYards(from, breakPoint);
  const leg2 = segmentYards(breakPoint, to);
  return { leg1, leg2, total: leg1 + leg2 };
}

export function yardageMatchDelta(measured: number, target: number): number {
  return measured - target;
}

export function yardageMatchTone(
  delta: number
): "match" | "close" | "off" {
  const abs = Math.abs(delta);
  if (abs <= 5) return "match";
  if (abs <= 15) return "close";
  return "off";
}

export function createBreakAnchorIcon(): google.maps.Icon {
  const size = 30;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      url: "",
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size / 2, size / 2),
    };
  }

  const center = size / 2;
  ctx.beginPath();
  ctx.arc(center, center, 10, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center, center, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  return {
    url: canvas.toDataURL(),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(center, center),
  };
}

export function createYardageBadgeIcon(yards: number): google.maps.Icon {
  const text = String(yards);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      url: "",
      scaledSize: new google.maps.Size(40, 24),
      anchor: new google.maps.Point(20, 12),
    };
  }

  ctx.font = "bold 13px system-ui, sans-serif";
  const textWidth = ctx.measureText(text).width;
  const width = Math.ceil(textWidth + 22);
  const height = 24;
  canvas.width = width;
  canvas.height = height;

  const radius = 11;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(width - radius, 0);
  ctx.quadraticCurveTo(width, 0, width, radius);
  ctx.lineTo(width, height - radius);
  ctx.quadraticCurveTo(width, height, width - radius, height);
  ctx.lineTo(radius, height);
  ctx.quadraticCurveTo(0, height, 0, height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2 + 0.5);

  return {
    url: canvas.toDataURL(),
    scaledSize: new google.maps.Size(width, height),
    anchor: new google.maps.Point(width / 2, height / 2),
  };
}

export function startPointIcon(): google.maps.Symbol {
  return {
    path: 0,
    scale: 12,
    fillColor: "#ef4444",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}
