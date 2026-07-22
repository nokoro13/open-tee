import type { GeolocationPosition } from "@/hooks/use-geolocation";
import type { GreenTargets } from "@/lib/green-distance";
import { yardsBetween } from "@/lib/green-distance";
import type { GeoJsonFeatureCollection } from "@/lib/geojson";
import {
  extractHoleLinePath,
  extractSharedLineBreak,
  type HoleDistanceGuide,
} from "@/lib/hole-distance-guide";
import { teeMarkerStrokeColor } from "@/lib/course-tees";
import { computeHoleMapView } from "@/lib/hole-map-view";

export type LatLngLiteral = { lat: number; lng: number };

export type HoleMapPolygonOverlay = {
  kind: "polygon";
  featureType: string;
  paths: LatLngLiteral[][];
  key: string;
};

export type HoleMapPolylineOverlay = {
  kind: "polyline";
  featureType: string;
  path: LatLngLiteral[];
  key: string;
};

export type HoleMapPointOverlay = {
  kind: "point";
  featureType: string;
  position: LatLngLiteral;
  key: string;
};

export type HoleMapOverlay =
  | HoleMapPolygonOverlay
  | HoleMapPolylineOverlay
  | HoleMapPointOverlay;

export type HoleMapMarker = {
  key: string;
  position: LatLngLiteral;
  label: string;
  fill: string;
  stroke: string;
  radius: number;
  pulse?: boolean;
};

export type HoleMapScene = {
  view: NonNullable<ReturnType<typeof computeHoleMapView>>;
  overlays: HoleMapOverlay[];
  markers: HoleMapMarker[];
  distanceGuide: HoleDistanceGuide | null;
  distanceToPin: number | null;
};

const MAX_PLAYER_INCLUDE_YARDS = 700;

const DRAW_ORDER = [
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
] as const;

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

function toLatLng([lng, lat]: [number, number]): LatLngLiteral {
  return { lat, lng };
}

function overlaysFromGeometry(
  featureType: string,
  geometry: unknown,
  keyPrefix: string
): HoleMapOverlay[] {
  if (!geometry || typeof geometry !== "object") return [];

  const typed = geometry as
    | LineStringGeometry
    | PolygonGeometry
    | MultiPolygonGeometry
    | PointGeometry;

  if (typed.type === "Point") {
    return [
      {
        kind: "point",
        featureType,
        position: toLatLng(typed.coordinates),
        key: `${keyPrefix}:point`,
      },
    ];
  }

  if (typed.type === "MultiPolygon") {
    return typed.coordinates.flatMap((polygon, polygonIndex) =>
      polygon.map((ring, ringIndex) => ({
        kind: "polygon" as const,
        featureType,
        paths: [ring.map(toLatLng)],
        key: `${keyPrefix}:multipolygon:${polygonIndex}:${ringIndex}`,
      }))
    );
  }

  if (typed.type === "Polygon") {
    return typed.coordinates.map((ring, ringIndex) => ({
      kind: "polygon" as const,
      featureType,
      paths: [ring.map(toLatLng)],
      key: `${keyPrefix}:polygon:${ringIndex}`,
    }));
  }

  if (typed.type === "LineString") {
    return [
      {
        kind: "polyline",
        featureType,
        path: typed.coordinates.map(toLatLng),
        key: `${keyPrefix}:line`,
      },
    ];
  }

  return [];
}

export function buildHoleMapScene(options: {
  features: GeoJsonFeatureCollection;
  targets: GreenTargets | null;
  playerPosition: GeolocationPosition | null;
  includeFeatureOverlays?: boolean;
  preferredTeeKey?: string | null;
  preferredTeeColor?: string | null;
  /** When true, measure yardage from the player's GPS instead of the mapped tee. */
  usePlayerAsAnchor?: boolean;
}): HoleMapScene | null {
  const {
    features,
    targets,
    playerPosition,
    includeFeatureOverlays = true,
    preferredTeeKey = null,
    preferredTeeColor = null,
    usePlayerAsAnchor = false,
  } = options;
  const view = computeHoleMapView({
    features,
    targets,
    playerPosition,
    preferredTeeKey,
    usePlayerAsAnchor,
  });
  if (!view) return null;

  const rawOverlays: HoleMapOverlay[] = [];
  let holeLinePath: LatLngLiteral[] = [];
  let hasFairway = false;

  if (includeFeatureOverlays) {
    features.features.forEach((feature, index) => {
      const featureType = String(feature.properties?.featureType ?? "other");
      if (featureType === "fairway") hasFairway = true;

      rawOverlays.push(
        ...overlaysFromGeometry(featureType, feature.geometry, `feature:${index}`)
      );

      if (featureType === "hole_line" && feature.geometry) {
        const geometry = feature.geometry as LineStringGeometry;
        if (geometry.type === "LineString") {
          holeLinePath = geometry.coordinates.map(toLatLng);
        }
      }
    });
  }

  const overlays = includeFeatureOverlays
    ? [...rawOverlays].sort((left, right) => {
        const leftIndex = DRAW_ORDER.indexOf(
          left.featureType as (typeof DRAW_ORDER)[number]
        );
        const rightIndex = DRAW_ORDER.indexOf(
          right.featureType as (typeof DRAW_ORDER)[number]
        );
        const normalizedLeft = leftIndex === -1 ? DRAW_ORDER.length : leftIndex;
        const normalizedRight =
          rightIndex === -1 ? DRAW_ORDER.length : rightIndex;
        return normalizedLeft - normalizedRight;
      })
    : [];

  if (includeFeatureOverlays && !hasFairway && holeLinePath.length >= 2) {
    overlays.push({
      kind: "polyline",
      featureType: "fairway_corridor",
      path: holeLinePath,
      key: "fairway-corridor",
    });
  }

  const markers: HoleMapMarker[] = [];

  let includePlayer = false;
  let distanceGuide: HoleDistanceGuide | null = null;
  let distanceToPin: number | null = null;

  if (playerPosition && (usePlayerAsAnchor || view.tee)) {
    includePlayer =
      usePlayerAsAnchor ||
      (view.tee != null &&
        yardsBetween(
          { lat: playerPosition.lat, lng: playerPosition.lng },
          view.tee
        ) <= MAX_PLAYER_INCLUDE_YARDS);
  }

  const teeColor = preferredTeeColor ?? "#2563eb";

  if (targets) {
    const from =
      includePlayer && playerPosition
        ? { lat: playerPosition.lat, lng: playerPosition.lng }
        : view.tee;

    if (from) {
      distanceGuide = {
        from,
        to: targets.middle,
        holeLinePath: extractHoleLinePath(features, preferredTeeKey),
        lineBreak: extractSharedLineBreak(features, preferredTeeKey),
        fromKind: includePlayer && playerPosition ? "player" : "tee",
        teeColor,
      };
      distanceToPin = Math.round(yardsBetween(from, targets.middle));
    }
  }

  if (view.tee && distanceGuide?.fromKind !== "tee") {
    markers.push({
      key: "tee",
      position: view.tee,
      label: "T",
      fill: teeColor,
      stroke: teeMarkerStrokeColor(teeColor),
      radius: 9,
    });
  }

  if (targets && !distanceGuide) {
    markers.push(
      {
        key: "front",
        position: targets.front,
        label: "F",
        fill: "#fbbf24",
        stroke: "#ffffff",
        radius: 8,
      },
      {
        key: "middle",
        position: targets.middle,
        label: "M",
        fill: "#f59e0b",
        stroke: "#ffffff",
        radius: 8,
      },
      {
        key: "back",
        position: targets.back,
        label: "B",
        fill: "#d97706",
        stroke: "#ffffff",
        radius: 8,
      }
    );
  }

  return {
    view,
    overlays:
      includeFeatureOverlays && distanceGuide
        ? overlays.filter((overlay) => overlay.featureType !== "hole_line")
        : overlays,
    markers,
    distanceGuide,
    distanceToPin,
  };
}

export const HOLE_FEATURE_STYLES: Record<
  string,
  {
    fillColor?: string;
    fillOpacity?: number;
    strokeColor: string;
    strokeOpacity?: number;
    strokeWeight: number;
    strokeDash?: number[];
    zIndex: number;
  }
> = {
  rough: {
    fillColor: "#2d5a37",
    fillOpacity: 0.55,
    strokeColor: "#2f5238",
    strokeWeight: 1,
    zIndex: 1,
  },
  scrub: {
    fillColor: "#4a6741",
    fillOpacity: 0.6,
    strokeColor: "#4d6b42",
    strokeWeight: 1,
    zIndex: 2,
  },
  water: {
    fillColor: "#38bdf8",
    fillOpacity: 0.65,
    strokeColor: "#0369a1",
    strokeWeight: 1.5,
    zIndex: 3,
  },
  fairway: {
    fillColor: "#529c5f",
    fillOpacity: 0.72,
    strokeColor: "#3d7a4d",
    strokeWeight: 1.5,
    zIndex: 4,
  },
  bunker: {
    fillColor: "#eac488",
    fillOpacity: 0.82,
    strokeColor: "#b8864f",
    strokeWeight: 1.5,
    zIndex: 5,
  },
  cartpath: {
    strokeColor: "#cbd5e1",
    strokeOpacity: 0.85,
    strokeWeight: 3,
    strokeDash: [4, 4],
    zIndex: 6,
  },
  out_of_bounds: {
    strokeColor: "#f87171",
    strokeOpacity: 0.9,
    strokeWeight: 2.5,
    strokeDash: [8, 6],
    zIndex: 7,
  },
  tee: {
    fillColor: "#3b82f6",
    fillOpacity: 0.45,
    strokeColor: "#1d4ed8",
    strokeWeight: 1.5,
    zIndex: 8,
  },
  hole_line: {
    strokeColor: "#ffffff",
    strokeOpacity: 0.95,
    strokeWeight: 3,
    zIndex: 9,
  },
  fairway_corridor: {
    strokeColor: "#60a86c",
    strokeOpacity: 0.45,
    strokeWeight: 8,
    zIndex: 4,
  },
  green: {
    fillColor: "#4ade80",
    fillOpacity: 0.78,
    strokeColor: "#15803d",
    strokeWeight: 2,
    zIndex: 10,
  },
  tree: {
    fillColor: "#225430",
    fillOpacity: 0.95,
    strokeColor: "#bbf7d0",
    strokeWeight: 1,
    zIndex: 11,
  },
  other: {
    fillColor: "#78916e",
    fillOpacity: 0.35,
    strokeColor: "#64748b",
    strokeWeight: 1,
    zIndex: 0,
  },
};
