"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPin, Maximize2, XIcon } from "lucide-react";

import type { LiveDistanceStatus } from "@/hooks/use-live-distances";
import type { GeolocationPosition } from "@/hooks/use-geolocation";
import type { GreenTargets, LiveDistances } from "@/lib/green-distance";
import { MIN_LIVE_DISTANCE_YARDS } from "@/lib/green-distance";
import type { GeoJsonFeatureCollection } from "@/lib/geojson";
import {
  HoleGoogleMap,
  type HoleGoogleMapHandle,
} from "@/components/public/hole-google-map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HoleMapModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holeNumber: number;
  courseId: string | null;
  features: GeoJsonFeatureCollection | null;
  targets: GreenTargets | null;
  playerPosition: GeolocationPosition | null;
  par?: number | null;
  yardage?: number | null;
  liveDistances?: LiveDistances;
  liveDistanceStatus?: LiveDistanceStatus;
};

function DistanceChip({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center rounded-xl border px-2 py-2.5",
        highlight
          ? "border-primary/40 bg-primary/15 shadow-[0_0_24px_-4px] shadow-primary/25"
          : "border-white/10 bg-white/5"
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
        {label}
      </span>
      <span
        className={cn(
          "mt-1 font-heading text-2xl font-semibold tabular-nums leading-none",
          highlight ? "text-white" : "text-white/90"
        )}
      >
        {value != null ? value : "—"}
      </span>
      {value != null && (
        <span className="mt-0.5 text-[10px] font-medium text-white/45">yards</span>
      )}
    </div>
  );
}

function GpsStatusBadge({ status }: { status: LiveDistanceStatus }) {
  const isLive = status === "live" || status === "at-green";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 backdrop-blur-md">
      {isLive ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400/70 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-sky-400" />
        </span>
      ) : (
        <Crosshair className="size-3 text-white/50" />
      )}
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
        {status === "live" && "Live GPS"}
        {status === "at-green" && "At green"}
        {status === "locating" && "Acquiring GPS"}
        {status === "denied" && "Location off"}
        {status === "unavailable" && "GPS unavailable"}
        {status === "hidden" && "GPS off"}
      </span>
    </div>
  );
}

export function HoleMapModal({
  open,
  onOpenChange,
  holeNumber,
  courseId,
  features,
  targets,
  playerPosition,
  par,
  yardage,
  liveDistances,
  liveDistanceStatus = "hidden",
}: HoleMapModalProps) {
  const mapRef = useRef<HoleGoogleMapHandle | null>(null);
  const [displayFeatures, setDisplayFeatures] =
    useState<GeoJsonFeatureCollection | null>(features);
  const [loadingFeatures, setLoadingFeatures] = useState(false);

  const distances = liveDistances ?? {
    front: null,
    middle: null,
    back: null,
  };
  const hasDistances =
    distances.front != null ||
    distances.middle != null ||
    distances.back != null;
  const showDistanceHud =
    liveDistanceStatus !== "hidden" &&
    (hasDistances || liveDistanceStatus === "locating");

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
          `/api/golf/courses/${courseId}/holes/${holeNumber}?enrich=1`
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

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close hole view"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />

      <div className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0f1712] shadow-2xl">
        <div className="relative shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Caddie view
              </p>
              <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                <h2 className="font-heading text-3xl font-semibold tabular-nums leading-none text-white">
                  Hole {holeNumber}
                </h2>
                <div className="flex flex-wrap items-center gap-2 pb-0.5">
                  {par != null && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-white/75">
                      Par {par}
                    </span>
                  )}
                  {yardage != null && yardage > 0 && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-white/75">
                      {yardage} yds
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => onOpenChange(false)}
            >
              <XIcon />
            </Button>
          </div>
          {loadingFeatures && (
            <p className="mt-2 text-xs text-white/45">Loading course features…</p>
          )}
        </div>

        {!displayFeatures ? (
          <p className="px-4 py-6 text-sm text-white/55">
            Hole view data is not available for this hole yet.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 shadow-inner">
              <HoleGoogleMap
                ref={mapRef}
                className="absolute inset-0"
                features={displayFeatures}
                targets={targets}
                playerPosition={playerPosition}
                holeNumber={holeNumber}
              />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-3 top-3 h-8 border border-white/10 bg-black/45 px-2.5 text-xs text-white/80 backdrop-blur-md hover:bg-black/60 hover:text-white"
                onClick={() => mapRef.current?.fitHole()}
              >
                <Maximize2 className="size-3.5" />
                Fit hole
              </Button>
            </div>

            {showDistanceHud && (
              <div className="shrink-0 rounded-2xl border border-white/10 bg-black/55 p-3 shadow-xl backdrop-blur-xl">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <GpsStatusBadge status={liveDistanceStatus} />
                  {liveDistanceStatus === "at-green" ||
                  (distances.middle != null &&
                    distances.middle <= MIN_LIVE_DISTANCE_YARDS) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300">
                      <MapPin className="size-3.5" />
                      On the green
                    </span>
                  ) : distances.middle != null ? (
                    <span className="text-xs text-white/50">
                      You ·{" "}
                      <span className="font-semibold tabular-nums text-white/80">
                        {distances.middle}y
                      </span>{" "}
                      to center
                    </span>
                  ) : null}
                </div>

                {liveDistanceStatus === "at-green" ||
                (distances.middle != null &&
                  distances.middle <= MIN_LIVE_DISTANCE_YARDS) ? (
                  <p className="text-center text-sm font-medium text-emerald-200/90">
                    You&apos;re on the green — pick your putt line.
                  </p>
                ) : hasDistances ? (
                  <div className="flex gap-2">
                    <DistanceChip label="Front" value={distances.front} />
                    <DistanceChip
                      label="Middle"
                      value={distances.middle}
                      highlight
                    />
                    <DistanceChip label="Back" value={distances.back} />
                  </div>
                ) : (
                  <p className="text-center text-sm text-white/55">
                    Waiting for GPS signal…
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
