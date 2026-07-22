"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Maximize2,
} from "lucide-react";

import type { LiveDistanceStatus } from "@/hooks/use-live-distances";
import type { GeolocationPosition } from "@/hooks/use-geolocation";
import type { GreenTargets, LiveDistances } from "@/lib/green-distance";
import type { GeoJsonFeatureCollection } from "@/lib/geojson";
import type { HoleMapScene } from "@/lib/hole-map-overlays";
import {
  HoleGoogleMap,
  type HoleGoogleMapHandle,
} from "@/components/public/hole-google-map";
import { requestGeolocationFromUserGesture } from "@/lib/geolocation-controller";
import { cn } from "@/lib/utils";

type HoleMapModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventSlug: string;
  holeNumber: number;
  courseId: string | null;
  features: GeoJsonFeatureCollection | null;
  targets: GreenTargets | null;
  playerPosition: GeolocationPosition | null;
  par?: number | null;
  yardage?: number | null;
  liveDistances?: LiveDistances;
  liveDistanceStatus?: LiveDistanceStatus;
  selectedTeeKey?: string | null;
  selectedTeeColor?: string | null;
  usePlayerAsAnchor?: boolean;
  onPreviousHole?: () => void;
  onNextHole?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
};

function formatHoleOrdinal(holeNumber: number): string {
  const mod100 = holeNumber % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${holeNumber}th`;
  switch (holeNumber % 10) {
    case 1:
      return `${holeNumber}st`;
    case 2:
      return `${holeNumber}nd`;
    case 3:
      return `${holeNumber}rd`;
    default:
      return `${holeNumber}th`;
  }
}

function MapChromeButton({
  className,
  children,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-white/10 bg-black/70 text-white backdrop-blur-md transition-colors hover:bg-black/85 active:scale-[0.98]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function CompassRose({ heading }: { heading: number }) {
  return (
    <div className="mt-2 flex justify-center">
      <div
        className="relative flex size-7 items-center justify-center rounded-full border border-white/15 bg-white/5"
        style={{ transform: `rotate(${-heading}deg)` }}
        aria-hidden
      >
        <span className="absolute top-0.5 text-[9px] font-bold leading-none text-white/85">
          N
        </span>
        <span className="size-1 rounded-full bg-white/35" />
      </div>
    </div>
  );
}

function ToPinOverlay({
  distance,
  heading,
  status,
}: {
  distance: number | null;
  heading: number;
  status: LiveDistanceStatus;
}) {
  const needsLocationAction =
    status === "prompt" || status === "denied" || status === "unavailable";

  const helperText =
    status === "prompt"
      ? "Tap to allow"
      : status === "denied"
        ? "Check Safari location settings"
        : status === "unavailable"
          ? "Tap to retry"
          : null;

  const label =
    status === "locating"
      ? "…"
      : status === "prompt"
        ? "Tap"
        : status === "denied" || status === "unavailable"
          ? "—"
          : distance != null
            ? String(distance)
            : "—";

  const handleLocationGesture = () => {
    requestGeolocationFromUserGesture();
  };

  const content = (
    <div
      className={cn(
        "min-w-[5.5rem] rounded-2xl border border-white/10 bg-black/78 px-4 py-3 shadow-xl backdrop-blur-md",
        needsLocationAction &&
          "pointer-events-auto cursor-pointer transition-colors hover:bg-black/88"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
        To pin
      </p>
      <p className="mt-0.5 font-heading text-4xl font-semibold tabular-nums leading-none text-white">
        {label}
      </p>
      {helperText ? (
        <p className="mt-1 text-[10px] font-medium text-white/55">{helperText}</p>
      ) : (
        <CompassRose heading={heading} />
      )}
    </div>
  );

  return (
    <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-30">
      {needsLocationAction ? (
        <button
          type="button"
          className="block text-left"
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            handleLocationGesture();
          }}
          onClick={handleLocationGesture}
          aria-label={
            status === "prompt"
              ? "Enable location for live yardage"
              : "Retry location for live yardage"
          }
        >
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  );
}

export function HoleMapModal({
  open,
  onOpenChange,
  eventSlug,
  holeNumber,
  courseId,
  features,
  targets,
  playerPosition,
  par,
  yardage,
  liveDistances,
  liveDistanceStatus = "hidden",
  selectedTeeKey = null,
  selectedTeeColor = null,
  usePlayerAsAnchor = false,
  onPreviousHole,
  onNextHole,
  canGoPrevious = false,
  canGoNext = false,
}: HoleMapModalProps) {
  const mapRef = useRef<HoleGoogleMapHandle | null>(null);
  const [displayFeatures, setDisplayFeatures] =
    useState<GeoJsonFeatureCollection | null>(features);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [mapScene, setMapScene] = useState<HoleMapScene | null>(null);

  const distances = liveDistances ?? {
    front: null,
    middle: null,
    back: null,
  };

  const distanceToPin = usePlayerAsAnchor
    ? (distances.middle ?? mapScene?.distanceToPin ?? null)
    : (mapScene?.distanceToPin ?? null);
  const distanceStatus = usePlayerAsAnchor ? liveDistanceStatus : "hidden";
  const mapHeading = mapScene?.view.bearing ?? 0;
  const mapFeatures = features ?? displayFeatures;

  const handleSceneChange = useCallback((scene: HoleMapScene) => {
    setMapScene(scene);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDisplayFeatures(features);
  }, [open, features]);

  useEffect(() => {
    if (!open || !courseId) return;

    let cancelled = false;
    setLoadingFeatures(true);

    async function loadFeatures() {
      try {
        const response = await fetch(
          `/api/golf/courses/${courseId}/holes/${holeNumber}`
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          features: GeoJsonFeatureCollection;
        };
        if (!cancelled) {
          setDisplayFeatures(data.features);
        }
      } catch {
        // Keep the server-provided features as fallback.
      } finally {
        if (!cancelled) {
          setLoadingFeatures(false);
        }
      }
    }

    void loadFeatures();

    return () => {
      cancelled = true;
    };
  }, [open, courseId, holeNumber]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const holeMeta =
    par != null && yardage != null && yardage > 0
      ? `Par ${par} · ${yardage} yds`
      : par != null
        ? `Par ${par}`
        : yardage != null && yardage > 0
          ? `${yardage} yds`
          : null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {!mapFeatures ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
          Hole view data is not available for this hole yet.
        </div>
      ) : (
        <HoleGoogleMap
          ref={mapRef}
          className="absolute inset-0"
          features={mapFeatures}
          targets={targets}
          playerPosition={playerPosition}
          holeNumber={holeNumber}
          onSceneChange={handleSceneChange}
          preferredTeeKey={selectedTeeKey}
          preferredTeeColor={selectedTeeColor}
          usePlayerAsAnchor={usePlayerAsAnchor}
          eventSlug={eventSlug}
          editableDogleg
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-black/70 via-black/35 to-transparent" />

      <div className="absolute inset-x-0 top-0 z-20 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="grid grid-cols-3 items-start">
          <div className="flex justify-start">
            <MapChromeButton
              className="pointer-events-auto size-10"
              aria-label="Back to scorecard"
              onClick={() => onOpenChange(false)}
            >
              <ChevronLeft className="size-4" />
            </MapChromeButton>
          </div>

          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-black/75 backdrop-blur-md">
              <MapChromeButton
                className="size-10 border-0 bg-transparent hover:bg-white/10"
                disabled={!canGoPrevious}
                aria-label="Previous hole"
                onClick={onPreviousHole}
              >
                <ChevronLeft className="size-4" />
              </MapChromeButton>
              <span className="inline-flex min-w-[4.5rem] items-center justify-center gap-1.5 px-1 text-sm font-semibold text-white">
                <Flag className="size-3.5 fill-white/90 text-white/90" />
                {formatHoleOrdinal(holeNumber)}
              </span>
              <MapChromeButton
                className="size-10 border-0 bg-transparent hover:bg-white/10"
                disabled={!canGoNext}
                aria-label="Next hole"
                onClick={onNextHole}
              >
                <ChevronRight className="size-4" />
              </MapChromeButton>
            </div>
            {holeMeta && (
              <span className="rounded-full border border-white/10 bg-black/70 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-md">
                {holeMeta}
              </span>
            )}
            {loadingFeatures && (
              <span className="text-[10px] text-white/45">Updating map…</span>
            )}
          </div>

          <div className="flex justify-end">
            <MapChromeButton
              className="pointer-events-auto size-10"
              aria-label="Fit hole to screen"
              onClick={() => mapRef.current?.fitHole({ animate: true })}
            >
              <Maximize2 className="size-4" />
            </MapChromeButton>
          </div>
        </div>
      </div>

      <ToPinOverlay
        distance={distanceToPin}
        heading={mapHeading}
        status={distanceStatus}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
    </div>
  );
}
