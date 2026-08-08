"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  APIProvider,
  Map,
  RenderingType,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Maximize2,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";

import type { CourseTee } from "@/db/schema";
import type { LatLng } from "@/lib/green-distance";
import { yardsBetween } from "@/lib/green-distance";
import { HoleLinePolylines } from "@/components/maps/hole-line-polylines";
import { HoleMapCameraController } from "@/components/maps/hole-map-camera-controller";
import {
  BreakAnchorMarker,
  LabeledCircleMarker,
  YardageBadgeMarker,
} from "@/components/maps/hole-map-markers";
import {
  bearingDegrees,
  type HoleMapView,
} from "@/lib/hole-map-view";
import {
  getCombinationBaseTeeKeys,
  resolveCombinationTeeKeyForHole,
  sortCourseTees,
  teeMarkerColor,
  teesRequiringMapPins,
} from "@/lib/course-tees";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  measureHolePathYardage,
  midpoint,
  segmentYards,
  yardageMatchDelta,
  yardageMatchTone,
} from "@/lib/hole-distance-guide";
import {
  GOOGLE_MAPS_API_KEY,
  GOLF_SATELLITE_MAP_PROPS,
} from "@/lib/google-maps-config";

type PinMode =
  | { kind: "none" }
  | { kind: "green" }
  | { kind: "tee"; teeKey: string };

type HolePin =
  | { kind: "green"; lat: number; lng: number }
  | { kind: "tee"; teeKey: string; lat: number; lng: number }
  | { kind: "line_break"; lat: number; lng: number }
  | { kind: "dogleg"; enabled: boolean };

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
  onPreviousHole?: () => void;
  onNextHole?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
};

const MAP_PADDING = { top: 40, bottom: 48, left: 32, right: 32 };

function isHoleMapped(
  green: LatLng | null,
  tees: Record<string, LatLng>,
  courseTees: CourseTee[]
): boolean {
  if (!green) return false;
  return teesRequiringMapPins(courseTees).every((tee) => tees[tee.teeKey] != null);
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
      orientationTee: null,
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
    orientationTee: tee,
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
  return (
    <HoleMapCameraController
      view={view}
      resetKey={resetKey}
      padding={MAP_PADDING}
      enabled={enabled}
      cameraTilt={0}
      restrictZoom={false}
    />
  );
}

function YardageLineLabel({ from, to }: { from: LatLng; to: LatLng }) {
  const yards = segmentYards(from, to);

  return (
    <YardageBadgeMarker position={midpoint(from, to)} yards={yards} />
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
      <HoleLinePolylines path={[from, breakPoint]} />
      <HoleLinePolylines path={[breakPoint, to]} />
      <YardageLineLabel from={from} to={breakPoint} />
      <YardageLineLabel from={breakPoint} to={to} />
    </>
  );
}

function StraightTeeLine({ from, to }: { from: LatLng; to: LatLng }) {
  return (
    <>
      <HoleLinePolylines path={[from, to]} />
      <YardageLineLabel from={from} to={to} />
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
  return (
    <BreakAnchorMarker
      position={position}
      draggable={!disabled}
      zIndex={42}
      title="Drag to set the shared fairway dogleg"
      onDrag={onDrag}
      onDragEnd={onDragEnd}
    />
  );
}

function HoleYardageGuide({
  sortedTees,
  tees,
  green,
  hasDogleg,
  lineBreak,
  scorecardYardages,
  isDragging,
  focusedTeeKey,
  className,
}: {
  sortedTees: CourseTee[];
  tees: Record<string, LatLng>;
  green: LatLng | null;
  hasDogleg: boolean;
  lineBreak: LatLng | null;
  scorecardYardages: Record<string, number>;
  isDragging: boolean;
  focusedTeeKey: string | null;
  className?: string;
}) {
  const rows = sortedTees
    .map((tee) => {
      const baseKeys = getCombinationBaseTeeKeys(tee, sortedTees);
      const target = scorecardYardages[tee.teeKey];
      const resolvedTeeKey =
        baseKeys && target != null
          ? resolveCombinationTeeKeyForHole(target, scorecardYardages, baseKeys)
          : tee.teeKey;
      const from = resolvedTeeKey ? tees[resolvedTeeKey] : null;
      if (from == null || green == null || target == null) {
        return null;
      }

      if (hasDogleg) {
        if (lineBreak == null) return null;
        const measured = measureHolePathYardage(from, lineBreak, green);
        const delta = yardageMatchDelta(measured.total, target);
        return {
          tee,
          target,
          measured: measured.total,
          delta,
          tone: yardageMatchTone(delta),
        };
      }

      const measured = segmentYards(from, green);
      const delta = yardageMatchDelta(measured, target);
      return {
        tee,
        target,
        measured,
        delta,
        tone: yardageMatchTone(delta),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (rows.length === 0) return null;

  return (
    <div className={cn("pointer-events-none absolute left-2 top-2 z-10", className)}>
      <div className="pointer-events-auto rounded-md border border-white/15 bg-black/78 px-2 py-1.5 text-[11px] text-white shadow-lg backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/55">
            Yardage
          </span>
          {isDragging && (
            <span className="text-[10px] font-semibold text-emerald-400">
              Live
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          {rows.map((row) => (
            <div
              key={row.tee.teeKey}
              className={cn(
                "flex items-center gap-1.5 tabular-nums",
                focusedTeeKey === row.tee.teeKey && "text-white",
                focusedTeeKey != null &&
                  focusedTeeKey !== row.tee.teeKey &&
                  "text-white/55"
              )}
            >
              <span
                className="size-1.5 shrink-0 rounded-full border border-white/20"
                style={{ backgroundColor: teeMarkerColor(row.tee) }}
              />
              <span className="w-14 shrink-0 truncate font-medium">
                {row.tee.teeName}
              </span>
              <span className="shrink-0 text-white/60">
                {row.measured}
                <span className="text-white/30">/</span>
                {row.target}
              </span>
              <span
                className={cn(
                  "shrink-0 font-semibold",
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

function ControlSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function PinModeToggleGroup({
  children,
  columns = 1,
  compact = false,
}: {
  children: ReactNode;
  columns?: 1 | 2;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-muted/80 p-1",
        compact
          ? "inline-flex flex-wrap gap-1"
          : columns === 2
            ? "grid grid-cols-2 gap-1"
            : "grid grid-cols-1 gap-1"
      )}
    >
      {children}
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
  className,
  compact = false,
}: {
  active: boolean;
  label: string;
  color?: string;
  placed?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-md font-medium transition-colors",
        compact
          ? "gap-1.5 px-2 py-1 text-[11px]"
          : "w-full gap-2 px-2.5 py-2 text-xs",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {color ? (
        <span
          className={cn(
            "shrink-0 rounded-full border border-foreground/10",
            compact ? "size-2" : "size-2.5"
          )}
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className={cn(compact ? "whitespace-nowrap" : "min-w-0 flex-1 truncate text-left")}>
        {label}
      </span>
      {placed ? (
        <Check
          className={cn("shrink-0 text-primary", compact ? "size-2.5" : "size-3")}
          aria-hidden
        />
      ) : null}
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
  onPreviousHole,
  onNextHole,
  canGoPrevious = false,
  canGoNext = false,
}: CourseHolePinMapProps) {
  const sortedTees = useMemo(() => sortCourseTees(courseTees), [courseTees]);
  const mappingTees = useMemo(
    () => teesRequiringMapPins(courseTees),
    [courseTees]
  );
  const [green, setGreen] = useState<LatLng | null>(initialGreen);
  const [tees, setTees] = useState<Record<string, LatLng>>(initialTees);
  const [lineBreak, setLineBreak] = useState<LatLng | null>(initialLineBreak);
  const [hasDogleg, setHasDogleg] = useState(() => initialLineBreak != null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [isEditing, setIsEditing] = useState(
    () => !isHoleMapped(initialGreen, initialTees, courseTees)
  );
  const [mode, setMode] = useState<PinMode>({ kind: "none" });
  const [focusedTeeKey, setFocusedTeeKey] = useState<string | null>(() =>
    isHoleMapped(initialGreen, initialTees, courseTees)
      ? (mappingTees[0]?.teeKey ?? null)
      : null
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previousHoleRef = useRef(holeNumber);

  useEffect(() => {
    const holeChanged = previousHoleRef.current !== holeNumber;
    previousHoleRef.current = holeNumber;

    setGreen(initialGreen);
    setTees(initialTees);
    setLineBreak(initialLineBreak);
    setHasDogleg(initialLineBreak != null);
    setDragPreview(null);

    if (holeChanged) {
      const complete = isHoleMapped(initialGreen, initialTees, courseTees);
      setMode({ kind: "none" });
      setFocusedTeeKey(
        complete ? (mappingTees[0]?.teeKey ?? null) : null
      );
      setIsEditing(!complete);
    }
  }, [holeNumber, initialGreen, initialLineBreak, initialTees, courseTees, mappingTees]);

  useEffect(() => {
    if (mode.kind === "tee") {
      setFocusedTeeKey(mode.teeKey);
    }
  }, [mode]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  const holeComplete = isHoleMapped(green, tees, courseTees);
  const isLocked = readOnly || (holeComplete && !isEditing);
  const dragToAdjust = !readOnly && holeComplete && isEditing;
  const placedTeeCount = mappingTees.filter((tee) => tees[tee.teeKey]).length;
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
    if (!hasDogleg) return null;
    if (dragPreview?.kind === "line_break") {
      return { lat: dragPreview.lat, lng: dragPreview.lng };
    }
    if (lineBreak) return lineBreak;
    if (!liveGreen) return null;
    return defaultSharedLineBreak(liveGreen, liveTees, mappingTees);
  }, [dragPreview, hasDogleg, lineBreak, liveGreen, liveTees, mappingTees]);

  const canShowPathControls = liveGreen != null && placedTeeCount > 0;
  const pathControlsDisabled = readOnly || isLocked || isSaving;

  const handleDoglegToggle = useCallback(
    (enabled: boolean) => {
      if (pathControlsDisabled || !onSavePin || enabled === hasDogleg) return;

      setHasDogleg(enabled);
      if (enabled) {
        if (!lineBreak && liveGreen) {
          setLineBreak(defaultSharedLineBreak(liveGreen, liveTees, mappingTees));
        }
      } else {
        setLineBreak(null);
        setDragPreview(null);
      }

      void onSavePin({ kind: "dogleg", enabled });
    },
    [
      hasDogleg,
      lineBreak,
      liveGreen,
      liveTees,
      onSavePin,
      pathControlsDisabled,
      mappingTees,
    ]
  );

  const pinMapView = useMemo(
    () =>
      buildPinHoleMapView(
        initialGreen,
        initialTees,
        initialLineBreak,
        courseCenter,
        mappingTees
      ),
    [
      courseCenter,
      initialGreen,
      initialLineBreak,
      initialTees,
      mappingTees,
    ]
  );

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      const latLng = event.detail.latLng;
      if (!latLng || isSaving || isLocked || !onSavePin || mode.kind === "none") {
        return;
      }

      const point = { lat: latLng.lat, lng: latLng.lng };

      if (mode.kind === "green") {
        setGreen(point);
        void onSavePin({ kind: "green", ...point });
        return;
      }

      setTees((current) => ({ ...current, [mode.teeKey]: point }));
      void onSavePin({ kind: "tee", teeKey: mode.teeKey, ...point });
    },
    [isLocked, isSaving, mode, onSavePin]
  );

  const doglegTeeLines = useMemo(
    () =>
      hasDogleg && liveGreen && sharedLineBreak && focusedTeeKey
        ? mappingTees
            .filter((tee) => tee.teeKey === focusedTeeKey)
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
    [
      focusedTeeKey,
      hasDogleg,
      liveGreen,
      sharedLineBreak,
      mappingTees,
      liveTees,
    ]
  );

  const straightTeeLines = useMemo(
    () =>
      !hasDogleg && liveGreen && focusedTeeKey
        ? mappingTees
            .filter((tee) => tee.teeKey === focusedTeeKey)
            .map((tee) => {
              const from = liveTees[tee.teeKey];
              if (!from) return null;
              return { teeKey: tee.teeKey, from, to: liveGreen };
            })
            .filter((line): line is NonNullable<typeof line> => line != null)
        : [],
    [focusedTeeKey, hasDogleg, liveGreen, mappingTees, liveTees]
  );

  const focusedTeeName =
    mappingTees.find((tee) => tee.teeKey === focusedTeeKey)?.teeName ?? null;

  function selectTeeFocus(teeKey: string) {
    setFocusedTeeKey(teeKey);
    if (!readOnly && !isLocked && !dragToAdjust) {
      setMode({ kind: "tee", teeKey });
    }
  }

  const modeLabel =
    mode.kind === "green"
      ? "green"
      : mode.kind === "tee"
        ? (mappingTees.find((tee) => tee.teeKey === mode.teeKey)?.teeName ??
          "tee")
        : null;

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <p className="p-4 text-sm text-destructive">
        Google Maps API key is missing. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to pin
        holes.
      </p>
    );
  }

  const showPlacementPicker = !readOnly && !isLocked && !dragToAdjust;

  const compactPinToggles = (
    <>
      {showPlacementPicker && (
        <PinModeToggleGroup compact>
          <PinModeToggle
            compact
            active={mode.kind === "green"}
            label="Green"
            color="#16a34a"
            placed={green != null}
            onClick={() => {
              setMode({ kind: "green" });
              setFocusedTeeKey(null);
            }}
          />
        </PinModeToggleGroup>
      )}
      {mappingTees.length > 0 && (
        <PinModeToggleGroup compact>
          {mappingTees.map((tee) => (
            <PinModeToggle
              key={tee.teeKey}
              compact
              active={
                showPlacementPicker
                  ? mode.kind === "tee" && mode.teeKey === tee.teeKey
                  : focusedTeeKey === tee.teeKey
              }
              label={tee.teeName}
              color={teeMarkerColor(tee)}
              placed={tees[tee.teeKey] != null}
              onClick={() => selectTeeFocus(tee.teeKey)}
            />
          ))}
        </PinModeToggleGroup>
      )}
      {canShowPathControls && (
        <PinModeToggleGroup compact>
          <PinModeToggle
            compact
            active={!hasDogleg}
            label="Straight"
            onClick={() => handleDoglegToggle(false)}
            disabled={pathControlsDisabled}
          />
          <PinModeToggle
            compact
            active={hasDogleg}
            label="Dogleg"
            onClick={() => handleDoglegToggle(true)}
            disabled={pathControlsDisabled}
          />
        </PinModeToggleGroup>
      )}
    </>
  );

  const mapSurface = (
    <>
      {hasScorecardYardages && (
        <HoleYardageGuide
          sortedTees={sortedTees}
          tees={liveTees}
          green={liveGreen}
          hasDogleg={hasDogleg}
          lineBreak={sharedLineBreak}
          scorecardYardages={scorecardYardages}
          isDragging={dragPreview != null}
          focusedTeeKey={focusedTeeKey}
        />
      )}
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={pinMapView.center}
          defaultZoom={17}
          defaultHeading={pinMapView.bearing}
          {...GOLF_SATELLITE_MAP_PROPS}
          renderingType={RenderingType.VECTOR}
          gestureHandling="greedy"
          draggableCursor={
            dragToAdjust ||
            (showPlacementPicker && mode.kind !== "none")
              ? "crosshair"
              : undefined
          }
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
          {straightTeeLines.map((line) => (
            <StraightTeeLine key={line.teeKey} from={line.from} to={line.to} />
          ))}
          {doglegTeeLines.map((line) => (
            <TeeLineSegments
              key={line.teeKey}
              from={line.from}
              to={line.to}
              breakPoint={line.breakPoint}
            />
          ))}
          {hasDogleg && sharedLineBreak && focusedTeeKey && (
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
                setHasDogleg(true);
                void onSavePin({
                  kind: "line_break",
                  ...point,
                });
              }}
            />
          )}
          {mappingTees.map((tee) => {
            const position = liveTees[tee.teeKey];
            if (!position) return null;
            const canDrag = !isLocked && !isSaving;
            const isFocused = tee.teeKey === focusedTeeKey;
            return (
              <LabeledCircleMarker
                key={tee.teeKey}
                position={position}
                draggable={canDrag}
                clickable={canDrag}
                opacity={isFocused ? 1 : 0.45}
                zIndex={isFocused ? 42 : canDrag ? 40 : undefined}
                title={
                  canDrag
                    ? `Drag to move ${tee.teeName} tee`
                    : tee.teeName
                }
                label={tee.teeName.slice(0, 1).toUpperCase()}
                fill={teeMarkerColor(tee)}
                stroke="#ffffff"
                radius={9}
                onClick={() => selectTeeFocus(tee.teeKey)}
                onDrag={(point) => {
                  if (isLocked) return;
                  setFocusedTeeKey(tee.teeKey);
                  setDragPreview({
                    kind: "tee",
                    teeKey: tee.teeKey,
                    ...point,
                  });
                }}
                onDragEnd={(point) => {
                  if (isLocked || !onSavePin) return;
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
            <LabeledCircleMarker
              position={liveGreen}
              draggable={!isLocked && !isSaving}
              zIndex={!isLocked && !isSaving ? 41 : undefined}
              title={
                !isLocked && !isSaving ? "Drag to move green" : undefined
              }
              label="G"
              fill="#16a34a"
              stroke="#ffffff"
              radius={9}
              onDrag={(point) => {
                if (isLocked) return;
                setDragPreview({
                  kind: "green",
                  ...point,
                });
              }}
              onDragEnd={(point) => {
                if (isLocked || !onSavePin) return;
                setDragPreview(null);
                setGreen(point);
                void onSavePin({ kind: "green", ...point });
              }}
            />
          )}
        </Map>
      </APIProvider>
    </>
  );

  if (isFullscreen) {
    return (
      <div className={cn("fixed inset-0 z-50 flex flex-col bg-background", className)}>
        <div className="shrink-0 p-3">
          <div className="rounded-lg border bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Close full map"
                onClick={() => setIsFullscreen(false)}
              >
                <X />
              </Button>

              {(onPreviousHole || onNextHole) && (
                <div className="inline-flex items-center rounded-full border bg-muted/60">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="rounded-full"
                    disabled={!canGoPrevious}
                    aria-label="Previous hole"
                    onClick={onPreviousHole}
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="min-w-14 px-1 text-center text-xs font-semibold tabular-nums">
                    Hole {holeNumber}
                  </span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="rounded-full"
                    disabled={!canGoNext}
                    aria-label="Next hole"
                    onClick={onNextHole}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              )}

              {holeComplete && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Complete
                </span>
              )}

              <div className="hidden h-5 w-px bg-border sm:block" />

              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {compactPinToggles}
              </div>

              {!readOnly &&
                (isLocked ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    aria-label="Edit hole"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil />
                  </Button>
                ) : (
                  holeComplete &&
                  isEditing && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label="Lock hole"
                      onClick={() => setIsEditing(false)}
                    >
                      <ShieldCheck />
                    </Button>
                  )
                ))}

              <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:inline-flex">
                <Flag className="size-3" />
                {placedTeeCount}/{mappingTees.length}
                {isSaving && (
                  <span className="text-primary">· Saving…</span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">{mapSurface}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 h-full flex-col bg-background sm:flex-row",
        className
      )}
    >
      <div className="flex max-h-[48%] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-b bg-background sm:max-h-full sm:w-80 sm:border-b-0 sm:border-r">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 px-4 py-3">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {holeNumber}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium leading-tight">
                        Hole {holeNumber}
                      </p>
                      {holeComplete && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Complete
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label="Open full map"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <Maximize2 />
                  </Button>
                  {!readOnly &&
                    (isLocked ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        aria-label="Edit hole"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil />
                      </Button>
                    ) : (
                      holeComplete &&
                      isEditing && (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          aria-label="Lock hole"
                          onClick={() => setIsEditing(false)}
                        >
                          <ShieldCheck />
                        </Button>
                      )
                    ))}
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {readOnly
                  ? focusedTeeName
                    ? `Showing ${focusedTeeName} target line. Select another tee to switch.`
                    : "Select a tee box to show its target line."
                  : isLocked
                    ? "Locked — click Edit to adjust pins."
                    : dragToAdjust
                      ? focusedTeeName
                        ? `Editing ${focusedTeeName}. Select another tee to switch lines.`
                        : "Select a tee box, then drag pins to adjust."
                      : modeLabel == null
                        ? "Select green or a tee box, then click the map to place it."
                        : hasScorecardYardages
                          ? `Placing ${modeLabel}. Match map yardages to scorecard targets.`
                          : `Placing ${modeLabel}. Use Straight or Dogleg for the fairway path.`}
              </p>
            </div>

            <div className="space-y-3">
              {showPlacementPicker && (
                <ControlSection label="Place">
                  <PinModeToggleGroup>
                    <PinModeToggle
                      active={mode.kind === "green"}
                      label="Green"
                      color="#16a34a"
                      placed={green != null}
                      onClick={() => {
                        setMode({ kind: "green" });
                        setFocusedTeeKey(null);
                      }}
                    />
                  </PinModeToggleGroup>
                </ControlSection>
              )}

              {mappingTees.length > 0 && (
                <ControlSection label="Tee line">
                  <PinModeToggleGroup columns={2}>
                    {mappingTees.map((tee, index) => (
                      <PinModeToggle
                        key={tee.teeKey}
                        className={
                          mappingTees.length % 2 === 1 &&
                          index === mappingTees.length - 1
                            ? "col-span-2"
                            : undefined
                        }
                        active={
                          showPlacementPicker
                            ? mode.kind === "tee" && mode.teeKey === tee.teeKey
                            : focusedTeeKey === tee.teeKey
                        }
                        label={tee.teeName}
                        color={teeMarkerColor(tee)}
                        placed={tees[tee.teeKey] != null}
                        onClick={() => selectTeeFocus(tee.teeKey)}
                      />
                    ))}
                  </PinModeToggleGroup>
                </ControlSection>
              )}

              {canShowPathControls && (
                <ControlSection label="Path">
                  <PinModeToggleGroup columns={2}>
                    <PinModeToggle
                      active={!hasDogleg}
                      label="Straight"
                      onClick={() => handleDoglegToggle(false)}
                      disabled={pathControlsDisabled}
                    />
                    <PinModeToggle
                      active={hasDogleg}
                      label="Dogleg"
                      onClick={() => handleDoglegToggle(true)}
                      disabled={pathControlsDisabled}
                    />
                  </PinModeToggleGroup>
                </ControlSection>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Flag className="size-3.5" />
            {placedTeeCount}/{mappingTees.length} tees
            <span className="text-foreground/20">·</span>
            {green ? "Green set" : "Green needed"}
            {focusedTeeName && (
              <>
                <span className="text-foreground/20">·</span>
                <span className="text-foreground/80">{focusedTeeName} line</span>
              </>
            )}
          </span>
          {isSaving && <span className="text-primary">Saving…</span>}
        </div>
      </div>

      <div className="relative min-h-45 min-w-0 flex-1 bg-zinc-950/3">
        {mapSurface}
      </div>
    </div>
  );
}
