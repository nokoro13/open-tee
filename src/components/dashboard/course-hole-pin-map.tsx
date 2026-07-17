"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  measureHolePathYardage,
  midpoint,
  segmentYards,
  yardageMatchDelta,
  yardageMatchTone,
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
  | { kind: "line_break"; lat: number; lng: number };

type DragPreview =
  | { kind: "tee"; teeKey: string; lat: number; lng: number }
  | { kind: "green"; lat: number; lng: number }
  | { kind: "line_break"; lat: number; lng: number };

type CourseHolePinMapProps = {
  courseCenter: LatLng;
  holeNumber: number;
  courseTees: CourseTee[];
  initialGreen: LatLng | null;
  initialTees: Record<string, LatLng>;
  initialLineBreak?: LatLng | null;
  scorecardYardages?: Record<string, number>;
  onSavePin?: (pin: HolePin) => Promise<void>;
  isSaving?: boolean;
  readOnly?: boolean;
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

function defaultSharedLineBreak(
  green: LatLng,
  tees: Record<string, LatLng>,
  sortedTees: CourseTee[]
): LatLng {
  const teePositions = sortedTees
    .map((tee) => tees[tee.teeKey])
    .filter((point): point is LatLng => point != null);

  if (teePositions.length === 0) {
    return green;
  }

  const farthestTee = teePositions.reduce((farthest, current) =>
    yardsBetween(current, green) > yardsBetween(farthest, green)
      ? current
      : farthest
  );

  return midpoint(farthestTee, green);
}

function buildPinHoleMapView(
  green: LatLng | null,
  tees: Record<string, LatLng>,
  lineBreak: LatLng | null,
  courseCenter: LatLng,
  sortedTees: CourseTee[]
): HoleMapView {
  const teePositions = sortedTees
    .map((tee) => tees[tee.teeKey])
    .filter((point): point is LatLng => point != null);
  const breakPositions = lineBreak ? [lineBreak] : [];
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

function TeeLineSegments({
  from,
  to,
  breakPoint,
}: {
  from: LatLng;
  to: LatLng;
  breakPoint: LatLng;
}) {
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
    </>
  );
}

function SharedDoglegMarker({
  position,
  disabled,
  onDrag,
  onDragEnd,
}: {
  position: LatLng;
  disabled?: boolean;
  onDrag: (point: LatLng) => void;
  onDragEnd: (point: LatLng) => void;
}) {
  const breakIcon = useMemo(() => createBreakAnchorIcon(), []);

  return (
    <Marker
      position={position}
      draggable={!disabled}
      zIndex={42}
      title="Drag to set the shared fairway dogleg"
      icon={breakIcon}
      onDrag={(event) => {
        const latLng = event.latLng;
        if (!latLng) return;
        onDrag({ lat: latLng.lat(), lng: latLng.lng() });
      }}
      onDragEnd={(event) => {
        const latLng = event.latLng;
        if (!latLng) return;
        onDragEnd({ lat: latLng.lat(), lng: latLng.lng() });
      }}
    />
  );
}

function HoleYardageGuide({
  sortedTees,
  tees,
  green,
  lineBreak,
  scorecardYardages,
  isDragging,
}: {
  sortedTees: CourseTee[];
  tees: Record<string, LatLng>;
  green: LatLng | null;
  lineBreak: LatLng | null;
  scorecardYardages: Record<string, number>;
  isDragging: boolean;
}) {
  const rows = sortedTees
    .map((tee) => {
      const from = tees[tee.teeKey];
      const target = scorecardYardages[tee.teeKey];
      if (from == null || green == null || lineBreak == null || target == null) {
        return null;
      }

      const measured = measureHolePathYardage(from, lineBreak, green);
      const delta = yardageMatchDelta(measured.total, target);
      const tone = yardageMatchTone(delta);

      return {
        tee,
        target,
        measured,
        delta,
        tone,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (rows.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 w-[min(calc(100%-1.5rem),18rem)]">
      <div className="rounded-lg border border-white/15 bg-black/78 px-3 py-2.5 text-white shadow-lg backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-white/70">
            Yardage guide
          </p>
          {isDragging && (
            <span className="text-[10px] font-semibold text-emerald-400">Live</span>
          )}
        </div>
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.tee.teeKey}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-0.5 text-[11px]"
            >
              <span className="inline-flex items-center gap-1.5 font-medium text-white">
                <span
                  className="size-2 rounded-full border border-white/20"
                  style={{ backgroundColor: teeMarkerColor(row.tee) }}
                />
                {row.tee.teeName}
              </span>
              <span className="text-white/65">
                {row.measured.leg1}+{row.measured.leg2}={row.measured.total}
                <span className="text-white/30">/</span>
                {row.target}
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  row.tone === "match" && "text-emerald-400",
                  row.tone === "close" && "text-amber-400",
                  row.tone === "off" && "text-red-400"
                )}
              >
                {row.delta > 0 ? "+" : ""}
                {row.delta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
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
  initialLineBreak = null,
  scorecardYardages = {},
  onSavePin,
  isSaving = false,
  readOnly = false,
  className,
}: CourseHolePinMapProps) {
  const sortedTees = useMemo(() => sortCourseTees(courseTees), [courseTees]);
  const [green, setGreen] = useState<LatLng | null>(initialGreen);
  const [tees, setTees] = useState<Record<string, LatLng>>(initialTees);
  const [lineBreak, setLineBreak] = useState<LatLng | null>(initialLineBreak);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [isEditing, setIsEditing] = useState(
    () => !isHoleMapped(initialGreen, initialTees, courseTees)
  );
  const [mode, setMode] = useState<PinMode>(() =>
    nextPinMode(sortedTees, initialGreen, initialTees)
  );
  const previousHoleRef = useRef(holeNumber);

  useEffect(() => {
    const holeChanged = previousHoleRef.current !== holeNumber;
    previousHoleRef.current = holeNumber;

    setGreen(initialGreen);
    setTees(initialTees);
    setLineBreak(initialLineBreak);
    setDragPreview(null);
    setMode(nextPinMode(sortedTees, initialGreen, initialTees));

    if (holeChanged) {
      setIsEditing(!isHoleMapped(initialGreen, initialTees, sortedTees));
    }
  }, [holeNumber, initialGreen, initialLineBreak, initialTees, sortedTees]);

  const holeComplete = isHoleMapped(green, tees, sortedTees);
  const isLocked = readOnly || (holeComplete && !isEditing);
  const dragToAdjust = !readOnly && holeComplete && isEditing;
  const placedTeeCount = sortedTees.filter((tee) => tees[tee.teeKey]).length;
  const hasPinData =
    initialGreen != null || Object.keys(initialTees).length > 0;

  const hasScorecardYardages = useMemo(
    () =>
      sortedTees.some(
        (tee) => scorecardYardages[tee.teeKey] != null
      ),
    [scorecardYardages, sortedTees]
  );

  const liveGreen = useMemo(() => {
    if (dragPreview?.kind === "green") {
      return { lat: dragPreview.lat, lng: dragPreview.lng };
    }
    return green;
  }, [dragPreview, green]);

  const liveTees = useMemo(() => {
    if (dragPreview?.kind !== "tee") return tees;
    return {
      ...tees,
      [dragPreview.teeKey]: {
        lat: dragPreview.lat,
        lng: dragPreview.lng,
      },
    };
  }, [dragPreview, tees]);

  const sharedLineBreak = useMemo(() => {
    if (dragPreview?.kind === "line_break") {
      return { lat: dragPreview.lat, lng: dragPreview.lng };
    }
    if (lineBreak) return lineBreak;
    if (!liveGreen) return null;
    return defaultSharedLineBreak(liveGreen, liveTees, sortedTees);
  }, [dragPreview, lineBreak, liveGreen, liveTees, sortedTees]);

  const pinMapView = useMemo(
    () =>
      buildPinHoleMapView(
        initialGreen,
        initialTees,
        initialLineBreak,
        courseCenter,
        sortedTees
      ),
    [
      courseCenter,
      initialGreen,
      initialLineBreak,
      initialTees,
      sortedTees,
    ]
  );

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      const latLng = event.detail.latLng;
      if (!latLng || isSaving || isLocked || !onSavePin) return;

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
      void onSavePin({ kind: "tee", teeKey: mode.teeKey, ...point });
    },
    [green, isLocked, isSaving, mode, onSavePin, sortedTees, tees]
  );

  const teeLines = useMemo(
    () =>
      liveGreen && sharedLineBreak
        ? sortedTees
            .map((tee) => {
              const from = liveTees[tee.teeKey];
              if (!from) return null;
              return {
                teeKey: tee.teeKey,
                from,
                to: liveGreen,
                breakPoint: sharedLineBreak,
              };
            })
            .filter((line): line is NonNullable<typeof line> => line != null)
        : [],
    [liveGreen, sharedLineBreak, sortedTees, liveTees]
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
              {readOnly
                ? "Read-only preview of submitted hole mapping."
                : isLocked
                  ? "Locked — click Edit to adjust pins."
                  : dragToAdjust
                    ? "Drag pins to adjust. Yardages update live against your scorecard."
                    : hasScorecardYardages
                      ? `Placing ${modeLabel}. Match map yardages to scorecard targets on the map.`
                      : `Placing ${modeLabel}. Click the map or drag placed pins. Drag the shared fairway dogleg to match doglegs.`}
            </p>
          </div>

          {!readOnly &&
            (isLocked ? (
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
            ))}
        </div>

        {!readOnly && !isLocked && !dragToAdjust && (
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
        {hasScorecardYardages && (
          <HoleYardageGuide
            sortedTees={sortedTees}
            tees={liveTees}
            green={liveGreen}
            lineBreak={sharedLineBreak}
            scorecardYardages={scorecardYardages}
            isDragging={dragPreview != null}
          />
        )}
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
            onClick={isLocked || dragToAdjust ? undefined : handleMapClick}
            className="absolute inset-0 size-full"
          >
            <MapCameraController
              view={pinMapView}
              resetKey={holeNumber}
              enabled={hasPinData}
            />
            {teeLines.map((line) => (
              <TeeLineSegments
                key={line.teeKey}
                from={line.from}
                to={line.to}
                breakPoint={line.breakPoint}
              />
            ))}
            {sharedLineBreak && (
              <SharedDoglegMarker
                position={sharedLineBreak}
                disabled={isSaving || isLocked}
                onDrag={(point) => {
                  if (isLocked) return;
                  setDragPreview({ kind: "line_break", ...point });
                }}
                onDragEnd={(point) => {
                  if (isLocked || !onSavePin) return;
                  setDragPreview(null);
                  setLineBreak(point);
                  void onSavePin({
                    kind: "line_break",
                    ...point,
                  });
                }}
              />
            )}
            {sortedTees.map((tee) => {
              const position = liveTees[tee.teeKey];
              if (!position) return null;
              const canDrag = !isLocked && !isSaving;
              return (
                <Marker
                  key={tee.teeKey}
                  position={position}
                  draggable={canDrag}
                  zIndex={canDrag ? 40 : undefined}
                  title={
                    canDrag
                      ? `Drag to move ${tee.teeName} tee`
                      : undefined
                  }
                  label={{
                    text: tee.teeName.slice(0, 1).toUpperCase(),
                    color: "#ffffff",
                    fontWeight: "700",
                  }}
                  icon={markerIcon(teeMarkerColor(tee))}
                  onDrag={(event) => {
                    const latLng = event.latLng;
                    if (!latLng || isLocked) return;
                    setDragPreview({
                      kind: "tee",
                      teeKey: tee.teeKey,
                      lat: latLng.lat(),
                      lng: latLng.lng(),
                    });
                  }}
                  onDragEnd={(event) => {
                    const latLng = event.latLng;
                    if (!latLng || isLocked || !onSavePin) return;
                    const point = { lat: latLng.lat(), lng: latLng.lng() };
                    setDragPreview(null);
                    setTees((current) => ({
                      ...current,
                      [tee.teeKey]: point,
                    }));
                    void onSavePin({
                      kind: "tee",
                      teeKey: tee.teeKey,
                      ...point,
                    });
                  }}
                />
              );
            })}
            {liveGreen && (
              <Marker
                position={liveGreen}
                draggable={!isLocked && !isSaving}
                zIndex={!isLocked && !isSaving ? 41 : undefined}
                title={
                  !isLocked && !isSaving ? "Drag to move green" : undefined
                }
                label={{ text: "G", color: "#ffffff", fontWeight: "700" }}
                icon={markerIcon("#16a34a")}
                onDrag={(event) => {
                  const latLng = event.latLng;
                  if (!latLng || isLocked) return;
                  setDragPreview({
                    kind: "green",
                    lat: latLng.lat(),
                    lng: latLng.lng(),
                  });
                }}
                onDragEnd={(event) => {
                  const latLng = event.latLng;
                  if (!latLng || isLocked || !onSavePin) return;
                  const point = { lat: latLng.lat(), lng: latLng.lng() };
                  setDragPreview(null);
                  setGreen(point);
                  void onSavePin({ kind: "green", ...point });
                }}
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
