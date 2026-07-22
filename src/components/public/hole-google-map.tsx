"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  forwardRef,
} from "react";
import {
  APIProvider,
  Map,
  Polygon,
  RenderingType,
} from "@vis.gl/react-google-maps";

import { HoleMapCameraController } from "@/components/maps/hole-map-camera-controller";
import type { FitHoleOptions } from "@/components/maps/hole-map-camera-controller";
import {
  FeaturePointMarker,
  LabeledCircleMarker,
  PulseRingMarker,
} from "@/components/maps/hole-map-markers";
import type { GeolocationPosition } from "@/hooks/use-geolocation";
import type { GreenTargets } from "@/lib/green-distance";
import type { GeoJsonFeatureCollection } from "@/lib/geojson";
import { teeMarkerLabelColor } from "@/lib/course-tees";
import {
  GOOGLE_MAPS_API_KEY,
  GOLF_SATELLITE_MAP_PROPS,
} from "@/lib/google-maps-config";
import {
  buildHoleMapScene,
  HOLE_FEATURE_STYLES,
  type HoleMapOverlay,
  type HoleMapMarker,
  type HoleMapScene,
} from "@/lib/hole-map-overlays";
import { HoleDistanceGuideLayer } from "@/components/public/hole-distance-guide";

const MAP_PADDING = { top: 120, bottom: 96, left: 32, right: 32 };

export type HoleGoogleMapHandle = {
  fitHole: (options?: FitHoleOptions) => void;
};

type HoleGoogleMapProps = {
  features: GeoJsonFeatureCollection;
  targets: GreenTargets | null;
  playerPosition: GeolocationPosition | null;
  holeNumber: number;
  className?: string;
  onSceneChange?: (scene: HoleMapScene) => void;
  preferredTeeKey?: string | null;
  preferredTeeColor?: string | null;
  usePlayerAsAnchor?: boolean;
  eventSlug?: string;
  editableDogleg?: boolean;
};

function getOverlayStyle(featureType: string) {
  return HOLE_FEATURE_STYLES[featureType] ?? HOLE_FEATURE_STYLES.other!;
}

function HoleMapOverlayLayer({ overlay }: { overlay: HoleMapOverlay }) {
  const style = getOverlayStyle(overlay.featureType);

  if (overlay.kind === "polygon") {
    return (
      <Polygon
        key={overlay.key}
        paths={overlay.paths}
        fillColor={style.fillColor}
        fillOpacity={style.fillOpacity ?? 0}
        strokeColor={style.strokeColor}
        strokeOpacity={style.strokeOpacity ?? 1}
        strokeWeight={style.strokeWeight}
        zIndex={style.zIndex}
        clickable={false}
      />
    );
  }

  if (overlay.kind === "polyline") {
    return null;
  }

  return (
    <FeaturePointMarker
      key={overlay.key}
      position={overlay.position}
      fillColor={style.fillColor ?? "#225430"}
      strokeColor={style.strokeColor}
      zIndex={style.zIndex}
    />
  );
}

function HoleMapMarkerLayer({ marker }: { marker: HoleMapMarker }) {
  return (
    <>
      {marker.pulse && (
        <PulseRingMarker
          position={marker.position}
          radius={marker.radius}
        />
      )}
      <LabeledCircleMarker
        position={marker.position}
        label={marker.label}
        fill={marker.fill}
        stroke={marker.stroke}
        radius={marker.radius}
        labelColor={
          marker.label === "T"
            ? teeMarkerLabelColor(marker.fill)
            : "#111827"
        }
        zIndex={21}
      />
    </>
  );
}

function HoleGoogleMapScene({
  scene,
  holeNumber,
  onFitHoleReady,
  eventSlug,
  editableDogleg,
}: {
  scene: HoleMapScene;
  holeNumber: number;
  onFitHoleReady: (fitHole: (options?: FitHoleOptions) => void) => void;
  eventSlug?: string;
  editableDogleg?: boolean;
}) {
  const { view, overlays, markers, distanceGuide } = scene;

  return (
    <Map
      defaultCenter={view.center}
      defaultZoom={17}
      defaultHeading={view.bearing}
      {...GOLF_SATELLITE_MAP_PROPS}
      renderingType={RenderingType.VECTOR}
      gestureHandling="greedy"
      disableDefaultUI
      rotateControl={false}
      clickableIcons={false}
      className="h-full w-full"
      style={{ width: "100%", height: "100%" }}
    >
      <HoleMapCameraController
        view={view}
        resetKey={holeNumber}
        padding={MAP_PADDING}
        onReady={onFitHoleReady}
      />

      {overlays.map((overlay) => (
        <HoleMapOverlayLayer key={overlay.key} overlay={overlay} />
      ))}

      {distanceGuide && (
        <HoleDistanceGuideLayer
          guide={distanceGuide}
          holeNumber={holeNumber}
          eventSlug={eventSlug}
          editable={editableDogleg}
        />
      )}

      {markers.map((marker) => (
        <HoleMapMarkerLayer key={marker.key} marker={marker} />
      ))}
    </Map>
  );
}

export const HoleGoogleMap = forwardRef<HoleGoogleMapHandle, HoleGoogleMapProps>(
  function HoleGoogleMap(
    { features, targets, playerPosition, holeNumber, className, onSceneChange, preferredTeeKey, preferredTeeColor, usePlayerAsAnchor = false, eventSlug, editableDogleg = false },
    ref
  ) {
    const fitHoleRef = useRef<((options?: FitHoleOptions) => void) | null>(null);
    const scene = useMemo(
      () =>
        buildHoleMapScene({
          features,
          targets,
          playerPosition,
          includeFeatureOverlays: false,
          preferredTeeKey,
          preferredTeeColor,
          usePlayerAsAnchor,
        }),
      [features, targets, playerPosition, preferredTeeKey, preferredTeeColor, usePlayerAsAnchor]
    );

    useEffect(() => {
      if (scene) {
        onSceneChange?.(scene);
      }
    }, [onSceneChange, scene]);

    const handleFitHoleReady = useCallback((fitHole: (options?: FitHoleOptions) => void) => {
      fitHoleRef.current = fitHole;
    }, []);

    useImperativeHandle(ref, () => ({
      fitHole: (options?: FitHoleOptions) => {
        fitHoleRef.current?.(options);
      },
    }));

    if (!GOOGLE_MAPS_API_KEY) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
          Google Maps API key is not configured.
        </div>
      );
    }

    if (!scene) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
          Unable to build the hole map for this hole.
        </div>
      );
    }

    return (
      <div className={className}>
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <HoleGoogleMapScene
            scene={scene}
            holeNumber={holeNumber}
            onFitHoleReady={handleFitHoleReady}
            eventSlug={eventSlug}
            editableDogleg={editableDogleg}
          />
        </APIProvider>
      </div>
    );
  }
);
