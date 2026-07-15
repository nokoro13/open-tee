"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  Polyline,
  RenderingType,
  useMap,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { Flag, Pencil, ShieldCheck } from "lucide-react";

import type { CourseTee } from "@/db/schema";
import type { LatLng } from "@/lib/green-distance";
import { yardsBetween } from "@/lib/green-distance";
import {
  createBreakAnchorIcon,
  createYardageBadgeIcon,
  midpoint,
  segmentYards,
} from "@/lib/hole-distance-guide";
import {
  bearingDegrees,
  computeHoleMapCamera,
  type HoleMapView,
} from "@/lib/hole-map-view";
import { sortCourseTees, teeMarkerColor } from "@/lib/course-tees";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const MAP_PADDING = { top: 40, bottom: 48, left: 32, right: 32 };

const GOLF_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

type PinMode =
  | { kind: "green" }
  | { kind: "tee"; teeKey: string };

type HolePin =
  | { kind: "green"; lat: number; lng: number }
  | { kind: "tee"; teeKey: string; lat: number; lng: number }
  | { kind: "line_break"; teeKey: string; lat: number; lng: number };

type CourseHolePinMapProps = {
  courseCenter: LatLng;
  holeNumber: number;
  courseTees: CourseTee[];
  initialGreen: LatLng | null;
  initialTees: Record<string, LatLng>;
  initialLineBreaks?: Record<string, LatLng>;
  onSavePin: (pin: HolePin) => Promise<void>;
  isSaving?: boolean;
  className?: string;
};

function markerIcon(color: string) {
  return {
    path: 0,
    scale: 9,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

function isHoleMapped(
  green: LatLng | null,
  tees: Record<string, LatLng>,
  courseTees: CourseTee[]
): boolean {
  if (!green) return false;
  return sortCourseTees(courseTees).every((tee) => tees[tee.teeKey] != null);
}

function nextPinMode(
  tees: CourseTee[],
  green: LatLng | null,
  placedTees: Record<string, LatLng>
): PinMode {
  if (!green) return { kind: "green" };
  const missingTee = sortCourseTees(tees).find((tee) => !placedTees[tee.teeKey]);
  if (missingTee) return { kind: "tee", teeKey: missingTee.teeKey };
  return { kind: "green" };
}

function buildPinHoleMapView(
  green: LatLng | null,
  tees: Record<string, LatLng>,
  lineBreaks: Record<string, LatLng>,
  courseCenter: LatLng,
  sortedTees: CourseTee[]
): HoleMapView {
  const teePositions = sortedTees
    .map((tee) => tees[tee.teeKey])
    .filter((point): point is LatLng => point != null);
  const breakPositions = Object.values(lineBreaks);
  const extentPoints = [
    ...(green ? [green] : []),
    ...teePositions,
    ...breakPositions,
  ];

  if (extentPoints.length === 0) {
    return {
      bounds: {
        minLat: courseCenter.lat,
        maxLat: courseCenter.lat,
        minLng: courseCenter.lng,
        maxLng: courseCenter.lng,
      },
      center: courseCenter,
      bearing: 0,
      tee: null,
      green: null,
      back: null,
      extentPoints: [courseCenter],
    };
  }

  let tee = teePositions[0] ?? null;
  if (green && teePositions.length > 1) {
    tee = teePositions.reduce((farthest, current) =>
      yardsBetween(current, green) > yardsBetween(farthest, green)
        ? current
        : farthest
    );
  }

  const bearing = tee && green ? bearingDegrees(tee, green) : 0;
  const center =
    tee && green
      ? midpoint(tee, green)
      : {
          lat:
            extentPoints.reduce((sum, point) => sum + point.lat, 0) /
            extentPoints.length,
          lng:
            extentPoints.reduce((sum, point) => sum + point.lng, 0) /
            extentPoints.length,
        };

  const lats = extentPoints.map((point) => point.lat);
  const lngs = extentPoints.map((point) => point.lng);

  return {
    bounds: {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    },
    center,
    bearing,
    tee,
    green,
    back: null,
    extentPoints,
  };
}

function MapCameraController({
  view,
  resetKey,
  enabled,
}: {
  view: HoleMapView;
  resetKey: number;
  enabled: boolean;
}) {
  const map = useMap();

  const fitHole = useCallback(() => {
    if (!map) return;

    const div = map.getDiv();
    const rect = div.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) return;

    if (!enabled) {
      map.moveCamera({
        center: view.center,
        zoom: 17,
        heading: 0,
        tilt: 0,
      });
      return;
    }

    const camera = computeHoleMapCamera({
      view,
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
  }, [enabled, map, view]);

  useEffect(() => {
    fitHole();
  }, [fitHole, resetKey]);

  useEffect(() => {
    if (!map) return;

    const div = map.getDiv();
    const observer = new ResizeObserver(() => {
      fitHole();
    });
    observer.observe(div);

    return () => {
      observer.disconnect();
    };
  }, [map, fitHole]);

  return null;
}

function YardageLineLabel({ from, to }: { from: LatLng; to: LatLng }) {
  const yards = segmentYards(from, to);
  const icon = useMemo(() => createYardageBadgeIcon(yards), [yards]);

  return (
    <Marker
      position={midpoint(from, to)}
      clickable={false}
      zIndex={24}
      icon={icon}
    />
  );
}

function TeeLineGuide({
  teeKey,
  from,
  to,
  initialBreak,
  disabled,
  onBreakChange,
}: {
  teeKey: string;
  from: LatLng;
  to: LatLng;
  initialBreak?: LatLng | null;
  disabled?: boolean;
  onBreakChange: (point: LatLng) => void;
}) {
  const [breakPoint, setBreakPoint] = useState(
    () => initialBreak ?? midpoint(from, to)
  );
  const breakIcon = useMemo(() => createBreakAnchorIcon(), []);

  useEffect(() => {
    setBreakPoint(initialBreak ?? midpoint(from, to));
  }, [
    teeKey,
    from.lat,
    from.lng,
    to.lat,
    to.lng,
    initialBreak?.lat,
    initialBreak?.lng,
  ]);

  return (
    <>
      <Polyline
        path={[from, breakPoint]}
        strokeColor="#f8fafc"
        strokeOpacity={0.9}
        strokeWeight={2}
      />
      <Polyline
        path={[breakPoint, to]}
        strokeColor="#f8fafc"
        strokeOpacity={0.9}
        strokeWeight={2}
      />
      <YardageLineLabel from={from} to={breakPoint} />
      <YardageLineLabel from={breakPoint} to={to} />
      <Marker
        position={breakPoint}
        draggable={!disabled}
        zIndex={30}
        title="Drag to set the fairway dogleg"
        icon={breakIcon}
        onDragEnd={(event) => {
          const latLng = event.latLng;
          if (!latLng) return;
          const point = { lat: latLng.lat(), lng: latLng.lng() };
          setBreakPoint(point);
          onBreakChange(point);
        }}
      />
    </>
  );
}

function PinModeToggle({
  active,
  label,
  color,
  placed,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  color?: string;
  placed?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      {color && (
        <span
          className="size-2 shrink-0 rounded-full border border-foreground/10"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
      {placed && <span className="text-[10px] text-primary">✓</span>}
    </button>
  );
}

export function CourseHolePinMap({
  courseCenter,
  holeNumber,
  courseTees,
  initialGreen,
  initialTees,
  initialLineBreaks = {},
  onSavePin,
  isSaving = false,
  className,
}: CourseHolePinMapProps) {
  const sortedTees = useMemo(() => sortCourseTees(courseTees), [courseTees]);
  const [green, setGreen] = useState<LatLng | null>(initialGreen);
  const [tees, setTees] = useState<Record<string, LatLng>>(initialTees);
  const [lineBreaks, setLineBreaks] =
    useState<Record<string, LatLng>>(initialLineBreaks);
  const [isEditing, setIsEditing] = useState(
    () => !isHoleMapped(initialGreen, initialTees, courseTees)
  );
  const [mode, setMode] = useState<PinMode>(() =>
    nextPinMode(sortedTees, initialGreen, initialTees)
  );

  useEffect(() => {
    setGreen(initialGreen);
    setTees(initialTees);
    setLineBreaks(initialLineBreaks);
    setMode(nextPinMode(sortedTees, initialGreen, initialTees));
    setIsEditing(!isHoleMapped(initialGreen, initialTees, sortedTees));
  }, [holeNumber, initialGreen, initialLineBreaks, initialTees, sortedTees]);

  const holeComplete = isHoleMapped(green, tees, sortedTees);
  const isLocked = holeComplete && !isEditing;
  const placedTeeCount = sortedTees.filter((tee) => tees[tee.teeKey]).length;
  const hasPinData =
    initialGreen != null || Object.keys(initialTees).length > 0;

  const pinMapView = useMemo(
    () =>
      buildPinHoleMapView(
        initialGreen,
        initialTees,
        initialLineBreaks,
        courseCenter,
        sortedTees
      ),
    [
      courseCenter,
      initialGreen,
      initialLineBreaks,
      initialTees,
      sortedTees,
    ]
  );

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      const latLng = event.detail.latLng;
      if (!latLng || isSaving || isLocked) return;

      const point = { lat: latLng.lat, lng: latLng.lng };

      if (mode.kind === "green") {
        setGreen(point);
        const next = nextPinMode(sortedTees, point, tees);
        setMode(next);
        void onSavePin({ kind: "green", ...point });
        return;
      }

      const nextTees = { ...tees, [mode.teeKey]: point };
      setTees(nextTees);
      const nextMode = nextPinMode(sortedTees, green, nextTees);
      setMode(nextMode);
      if (isHoleMapped(green, nextTees, sortedTees)) {
        setIsEditing(false);
      }
      void onSavePin({ kind: "tee", teeKey: mode.teeKey, ...point });
    },
    [green, isLocked, isSaving, mode, onSavePin, sortedTees, tees]
  );

  const teeLines = useMemo(
    () =>
      green
        ? sortedTees
            .map((tee) => {
              const from = tees[tee.teeKey];
              if (!from) return null;
              return {
                teeKey: tee.teeKey,
                from,
                to: green,
                breakPoint: lineBreaks[tee.teeKey] ?? null,
              };
            })
            .filter((line): line is NonNullable<typeof line> => line != null)
        : [],
    [green, lineBreaks, sortedTees, tees]
  );

  const modeLabel =
    mode.kind === "green"
      ? "green"
      : sortedTees.find((tee) => tee.teeKey === mode.teeKey)?.teeName ?? "tee";

  if (!MAPS_API_KEY) {
    return (
      <p className="p-4 text-sm text-destructive">
        Google Maps API key is missing. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to pin
        holes.
      </p>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="shrink-0 border-b bg-background px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {holeNumber}
              </span>
              <p className="font-medium">Hole {holeNumber}</p>
              {holeComplete && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Complete
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLocked
                ? "Locked — click Edit to adjust pins."
                : `Placing ${modeLabel}. Drag fairway anchors to match doglegs.`}
            </p>
          </div>

          {isLocked ? (
            <Button type="button" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil />
              Edit
            </Button>
          ) : (
            holeComplete &&
            isEditing && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                <ShieldCheck />
                Lock hole
              </Button>
            )
          )}
        </div>

        {!isLocked && (
          <div className="mt-3 flex flex-wrap gap-1 rounded-lg bg-muted/80 p-1">
            <PinModeToggle
              active={mode.kind === "green"}
              label="Green"
              color="#16a34a"
              placed={green != null}
              onClick={() => setMode({ kind: "green" })}
            />
            {sortedTees.map((tee) => (
              <PinModeToggle
                key={tee.teeKey}
                active={mode.kind === "tee" && mode.teeKey === tee.teeKey}
                label={tee.teeName}
                color={teeMarkerColor(tee)}
                placed={tees[tee.teeKey] != null}
                onClick={() => setMode({ kind: "tee", teeKey: tee.teeKey })}
              />
            ))}
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1 bg-zinc-950/3">
        <APIProvider apiKey={MAPS_API_KEY}>
          <Map
            defaultCenter={pinMapView.center}
            defaultZoom={17}
            mapTypeId="satellite"
            renderingType={RenderingType.VECTOR}
            styles={GOLF_MAP_STYLES}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            rotateControl={false}
            headingInteractionEnabled={false}
            tiltInteractionEnabled={false}
            onClick={isLocked ? undefined : handleMapClick}
            className="absolute inset-0 size-full"
          >
            <MapCameraController
              view={pinMapView}
              resetKey={holeNumber}
              enabled={hasPinData}
            />
            {teeLines.map((line) => (
              <TeeLineGuide
                key={line.teeKey}
                teeKey={line.teeKey}
                from={line.from}
                to={line.to}
                initialBreak={line.breakPoint}
                disabled={isSaving || isLocked}
                onBreakChange={(point) => {
                  if (isLocked) return;
                  setLineBreaks((current) => ({
                    ...current,
                    [line.teeKey]: point,
                  }));
                  void onSavePin({
                    kind: "line_break",
                    teeKey: line.teeKey,
                    ...point,
                  });
                }}
              />
            ))}
            {sortedTees.map((tee) => {
              const position = tees[tee.teeKey];
              if (!position) return null;
              return (
                <Marker
                  key={tee.teeKey}
                  position={position}
                  label={{
                    text: tee.teeName.slice(0, 1).toUpperCase(),
                    color: "#ffffff",
                    fontWeight: "700",
                  }}
                  icon={markerIcon(teeMarkerColor(tee))}
                />
              );
            })}
            {green && (
              <Marker
                position={green}
                label={{ text: "G", color: "#ffffff", fontWeight: "700" }}
                icon={markerIcon("#16a34a")}
              />
            )}
          </Map>
        </APIProvider>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Flag className="size-3.5" />
          {placedTeeCount}/{sortedTees.length} tees
          <span className="text-foreground/20">·</span>
          {green ? "Green set" : "Green needed"}
        </span>
        {isSaving && <span className="text-primary">Saving…</span>}
      </div>
    </div>
  );
}
