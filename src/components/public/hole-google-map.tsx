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
  Marker,
  Polygon,
  Polyline,
  RenderingType,
  useMap,
} from "@vis.gl/react-google-maps";

import type { GeolocationPosition } from "@/hooks/use-geolocation";
import type { GreenTargets } from "@/lib/green-distance";
import type { GeoJsonFeatureCollection } from "@/lib/geojson";
import { teeMarkerLabelColor } from "@/lib/course-tees";
import {
  buildHoleMapScene,
  HOLE_FEATURE_STYLES,
  type HoleMapOverlay,
  type HoleMapMarker,
  type HoleMapScene,
} from "@/lib/hole-map-overlays";
import { computeHoleMapCamera } from "@/lib/hole-map-view";
import { HoleDistanceGuideLayer } from "@/components/public/hole-distance-guide";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const MAP_PADDING = { top: 120, bottom: 96, left: 32, right: 32 };
const CIRCLE_SYMBOL_PATH = 0;

// Satellite is the base layer; these styles suppress any remaining POI labels.
const GOLF_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function circleMarkerIcon(options: {
  scale: number;
  fillColor: string;
  fillOpacity?: number;
  strokeColor: string;
  strokeWeight: number;
}): google.maps.Symbol {
  return {
    path: CIRCLE_SYMBOL_PATH,
    scale: options.scale,
    fillColor: options.fillColor,
    fillOpacity: options.fillOpacity ?? 1,
    strokeColor: options.strokeColor,
    strokeWeight: options.strokeWeight,
  };
}

export type HoleGoogleMapHandle = {
  fitHole: () => void;
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
    return (
      <Polyline
        key={overlay.key}
        path={overlay.path}
        strokeColor={style.strokeColor}
        strokeOpacity={style.strokeOpacity ?? 1}
        strokeWeight={style.strokeWeight}
        zIndex={style.zIndex}
        clickable={false}
      />
    );
  }

  return (
    <Marker
      key={overlay.key}
      position={overlay.position}
      clickable={false}
      zIndex={style.zIndex}
      icon={circleMarkerIcon({
        scale: 4,
        fillColor: style.fillColor ?? "#225430",
        fillOpacity: style.fillOpacity ?? 1,
        strokeColor: style.strokeColor,
        strokeWeight: style.strokeWeight,
      })}
    />
  );
}

function HoleMapMarkerLayer({ marker }: { marker: HoleMapMarker }) {
  return (
    <>
      {marker.pulse && (
        <Marker
          position={marker.position}
          clickable={false}
          zIndex={20}
          icon={circleMarkerIcon({
            scale: marker.radius + 5,
            fillColor: "#60a5fa",
            fillOpacity: 0.22,
            strokeColor: "#60a5fa",
            strokeWeight: 0,
          })}
        />
      )}
      <Marker
        position={marker.position}
        clickable={false}
        zIndex={21}
        label={
          marker.label
            ? {
                text: marker.label,
                color:
                  marker.label === "T"
                    ? teeMarkerLabelColor(marker.fill)
                    : "#111827",
                fontWeight: "700",
                fontSize: "10px",
              }
            : undefined
        }
        icon={circleMarkerIcon({
          scale: marker.radius,
          fillColor: marker.fill,
          strokeColor: marker.stroke,
          strokeWeight: 2.5,
        })}
      />
    </>
  );
}

function MapCameraController({
  scene,
  resetKey,
  onReady,
}: {
  scene: HoleMapScene;
  resetKey: number;
  onReady: (fitHole: () => void) => void;
}) {
  const map = useMap();
  const viewRef = useRef(scene.view);
  viewRef.current = scene.view;
  const needsFitRef = useRef(true);

  const fitHole = useCallback(() => {
    if (!map) return;

    const div = map.getDiv();
    const rect = div.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) return;

    const camera = computeHoleMapCamera({
      view: viewRef.current,
      mapWidth: Math.max(rect.width, 1),
      mapHeight: Math.max(rect.height, 1),
      padding: MAP_PADDING,
    });

    map.moveCamera({
      center: camera.center,
      zoom: camera.zoom,
      heading: camera.heading,
      tilt: 0,
    });
  }, [map]);

  useEffect(() => {
    onReady(fitHole);
  }, [fitHole, onReady]);

  // Mark for refit when the active hole changes.
  useEffect(() => {
    needsFitRef.current = true;
  }, [resetKey]);

  // Refit once the scene geometry for that hole is ready — not on GPS drift.
  useEffect(() => {
    if (!needsFitRef.current) return;
    needsFitRef.current = false;
    fitHole();
  }, [
    fitHole,
    resetKey,
    scene.view.center.lat,
    scene.view.center.lng,
    scene.view.bearing,
  ]);

  return null;
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
  onFitHoleReady: (fitHole: () => void) => void;
  eventSlug?: string;
  editableDogleg?: boolean;
}) {
  const { view, overlays, markers, distanceGuide } = scene;

  return (
    <Map
      defaultCenter={view.center}
      defaultZoom={17}
      mapTypeId="satellite"
      renderingType={RenderingType.VECTOR}
      styles={GOLF_MAP_STYLES}
      gestureHandling="greedy"
      disableDefaultUI
      rotateControl={false}
      headingInteractionEnabled={false}
      tiltInteractionEnabled={false}
      clickableIcons={false}
      className="h-full w-full"
      style={{ width: "100%", height: "100%" }}
    >
      <MapCameraController
        scene={scene}
        resetKey={holeNumber}
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
    const fitHoleRef = useRef<(() => void) | null>(null);
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

    const handleFitHoleReady = useCallback((fitHole: () => void) => {
      fitHoleRef.current = fitHole;
    }, []);

    useImperativeHandle(ref, () => ({
      fitHole: () => {
        fitHoleRef.current?.();
      },
    }));

    if (!MAPS_API_KEY) {
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
        <APIProvider apiKey={MAPS_API_KEY}>
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
