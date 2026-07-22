"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  RenderingType,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Maximize2,
  Pencil,
  Ruler,
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
import { sortCourseTees, teeMarkerColor } from "@/lib/course-tees";
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
}: {
  sortedTees: CourseTee[];
  tees: Record<string, LatLng>;
  green: LatLng | null;
  hasDogleg: boolean;
  lineBreak: LatLng | null;
  scorecardYardages: Record<string, number>;
  isDragging: boolean;
  focusedTeeKey: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const rows = sortedTees
    .filter((tee) => focusedTeeKey == null || tee.teeKey === focusedTeeKey)
    .map((tee) => {
      const from = tees[tee.teeKey];
      const target = scorecardYardages[tee.teeKey];
      if (from == null || green == null || target == null) {
        return null;
      }

      if (hasDogleg) {
        if (lineBreak == null) return null;
        const measured = measureHolePathYardage(from, lineBreak, green);
        const delta = yardageMatchDelta(measured.total, target);
        const tone = yardageMatchTone(delta);

        return {
          tee,
          target,
          measuredLabel: `${measured.leg1}+${measured.leg2}=${measured.total}`,
          delta,
          tone,
        };
      }

      const measuredTotal = segmentYards(from, green);
      const delta = yardageMatchDelta(measuredTotal, target);
      const tone = yardageMatchTone(delta);

      return {
        tee,
        target,
        measuredLabel: String(measuredTotal),
        delta,
        tone,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (rows.length === 0) return null;

  const isOpen = expanded || isDragging;

  if (!isOpen) {
    return (
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/78 py-1.5 pl-2.5 pr-3 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/90"
        >
          <Ruler className="size-3 text-white/70" />
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">
            Yardage
          </span>
          <span className="inline-flex items-center gap-1">
            {rows.map((row) => (
              <span
                key={row.tee.teeKey}
                className={cn(
                  "size-1.5 rounded-full",
                  row.tone === "match" && "bg-emerald-400",
                  row.tone === "close" && "bg-amber-400",
                  row.tone === "off" && "bg-red-400"
                )}
              />
            ))}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 w-[min(calc(100%-1.5rem),17rem)]">
      <div className="pointer-events-auto rounded-lg border border-white/15 bg-black/78 px-3 py-2.5 text-white shadow-lg backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-white/70">
            Yardage guide
          </p>
          <div className="flex items-center gap-2">
            {isDragging && (
              <span className="text-[10px] font-semibold text-emerald-400">
                Live
              </span>
            )}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="-m-1 rounded p-1 text-white/60 transition-colors hover:text-white"
              aria-label="Collapse yardage guide"
            >
              <ChevronDown className="size-3.5 rotate-180" />
            </button>
          </div>
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
                {row.measuredLabel}
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
  onPreviousHole,
  onNextHole,
  canGoPrevious = false,
  canGoNext = false,
}: CourseHolePinMapProps) {
  const sortedTees = useMemo(() => sortCourseTees(courseTees), [courseTees]);
  const [green, setGreen] = useState<LatLng | null>(initialGreen);
  const [tees, setTees] = useState<Record<string, LatLng>>(initialTees);
  const [lineBreak, setLineBreak] = useState<LatLng | null>(initialLineBreak);
  const [hasDogleg, setHasDogleg] = useState(() => initialLineBreak != null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [isEditing, setIsEditing] = useState(
    () => !isHoleMapped(initialGreen, initialTees, courseTees)
  );
  const [mode, setMode] = useState<PinMode>(() =>
    nextPinMode(sortedTees, initialGreen, initialTees)
  );
  const [focusedTeeKey, setFocusedTeeKey] = useState<string | null>(
    () => sortedTees[0]?.teeKey ?? null
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
    const nextMode = nextPinMode(sortedTees, initialGreen, initialTees);
    setMode(nextMode);
    setFocusedTeeKey(
      nextMode.kind === "tee"
        ? nextMode.teeKey
        : (sortedTees[0]?.teeKey ?? null)
    );

    if (holeChanged) {
      setIsEditing(!isHoleMapped(initialGreen, initialTees, sortedTees));
    }
  }, [holeNumber, initialGreen, initialLineBreak, initialTees, sortedTees]);

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
    if (!hasDogleg) return null;
    if (dragPreview?.kind === "line_break") {
      return { lat: dragPreview.lat, lng: dragPreview.lng };
    }
    if (lineBreak) return lineBreak;
    if (!liveGreen) return null;
    return defaultSharedLineBreak(liveGreen, liveTees, sortedTees);
  }, [dragPreview, hasDogleg, lineBreak, liveGreen, liveTees, sortedTees]);

  const canShowPathControls = liveGreen != null && placedTeeCount > 0;
  const pathControlsDisabled = readOnly || isLocked || isSaving;

  const handleDoglegToggle = useCallback(
    (enabled: boolean) => {
      if (pathControlsDisabled || !onSavePin || enabled === hasDogleg) return;

      setHasDogleg(enabled);
      if (enabled) {
        if (!lineBreak && liveGreen) {
          setLineBreak(defaultSharedLineBreak(liveGreen, liveTees, sortedTees));
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
      sortedTees,
    ]
  );

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

  const doglegTeeLines = useMemo(
    () =>
      hasDogleg && liveGreen && sharedLineBreak && focusedTeeKey
        ? sortedTees
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
      sortedTees,
      liveTees,
    ]
  );

  const straightTeeLines = useMemo(
    () =>
      !hasDogleg && liveGreen && focusedTeeKey
        ? sortedTees
            .filter((tee) => tee.teeKey === focusedTeeKey)
            .map((tee) => {
              const from = liveTees[tee.teeKey];
              if (!from) return null;
              return { teeKey: tee.teeKey, from, to: liveGreen };
            })
            .filter((line): line is NonNullable<typeof line> => line != null)
        : [],
    [focusedTeeKey, hasDogleg, liveGreen, sortedTees, liveTees]
  );

  const focusedTeeName =
    sortedTees.find((tee) => tee.teeKey === focusedTeeKey)?.teeName ?? null;

  function selectTeeFocus(teeKey: string) {
    setFocusedTeeKey(teeKey);
    if (!readOnly && !isLocked && !dragToAdjust) {
      setMode({ kind: "tee", teeKey });
    }
  }

  const modeLabel =
    mode.kind === "green"
      ? "green"
      : sortedTees.find((tee) => tee.teeKey === mode.teeKey)?.teeName ?? "tee";

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <p className="p-4 text-sm text-destructive">
        Google Maps API key is missing. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to pin
        holes.
      </p>
    );
  }

  const showPlacementPicker = !readOnly && !isLocked && !dragToAdjust;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-background",
        isFullscreen
          ? "fixed inset-0 z-50"
          : "h-full",
        className
      )}
    >
      <div className="shrink-0 border-b bg-background px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {isFullscreen ? (
              <div className="flex items-center gap-2">
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
                    <span className="min-w-16 px-1 text-center text-sm font-semibold tabular-nums">
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
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Complete
                  </span>
                )}
              </div>
            ) : (
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
            )}
            <p className="text-xs text-muted-foreground">
              {readOnly
                ? focusedTeeName
                  ? `Showing ${focusedTeeName} target line. Select another tee to switch.`
                  : "Select a tee box to show its target line."
                : isLocked
                  ? "Locked — click Edit to adjust pins."
                  : dragToAdjust
                    ? focusedTeeName
                      ? `Editing ${focusedTeeName}. Only that tee's line is shown — select another tee to switch.`
                      : "Select a tee box to show its target line, then drag pins to adjust."
                    : hasScorecardYardages
                      ? `Placing ${modeLabel}. Match map yardages to scorecard targets on the map.`
                      : `Placing ${modeLabel}. Use Straight for a direct tee-to-green line, or Dogleg when the hole bends.`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isFullscreen && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsFullscreen(true)}
              >
                <Maximize2 />
                <span className="sm:hidden">Map</span>
                <span className="hidden sm:inline">Full map</span>
              </Button>
            )}
            {!readOnly &&
              (isLocked ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
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
        </div>

        <div className="mt-3 space-y-2">
          {showPlacementPicker && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Place
              </span>
              <div className="flex flex-wrap gap-1 rounded-lg bg-muted/80 p-1">
                <PinModeToggle
                  active={mode.kind === "green"}
                  label="Green"
                  color="#16a34a"
                  placed={green != null}
                  onClick={() => setMode({ kind: "green" })}
                />
              </div>
            </div>
          )}

          {sortedTees.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Tee line
              </span>
              <div className="flex flex-wrap gap-1 rounded-lg bg-muted/80 p-1">
                {sortedTees.map((tee) => (
                  <PinModeToggle
                    key={tee.teeKey}
                    active={focusedTeeKey === tee.teeKey}
                    label={tee.teeName}
                    color={teeMarkerColor(tee)}
                    placed={tees[tee.teeKey] != null}
                    onClick={() => selectTeeFocus(tee.teeKey)}
                  />
                ))}
              </div>
            </div>
          )}

          {canShowPathControls && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Path
              </span>
              <div className="flex flex-wrap gap-1 rounded-lg bg-muted/80 p-1">
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
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-zinc-950/3">
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
            {sortedTees.map((tee) => {
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
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Flag className="size-3.5" />
          {placedTeeCount}/{sortedTees.length} tees
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
  );
}
