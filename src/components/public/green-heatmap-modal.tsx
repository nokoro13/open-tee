"use client";

import { useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";

import type { GreenTargets } from "@/lib/green-distance";
import type { GeoJsonFeatureCollection } from "@/lib/geojson";
import {
  boundsFromGeoJson,
  drawPuttingGreenMap,
  extractGreenRing,
  type PuttingMapData,
} from "@/lib/green-putting-map";
import { Button } from "@/components/ui/button";

type HeatmapResponse = {
  gridWidth: number;
  gridHeight: number;
  slope: number[][];
  elevation: number[][];
  bounds?: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
};

type GreenHeatmapModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holeNumber: number;
  courseId: string | null;
  features?: GeoJsonFeatureCollection | null;
  targets?: GreenTargets | null;
};

export function GreenHeatmapModal({
  open,
  onOpenChange,
  holeNumber,
  courseId,
  features = null,
  targets = null,
}: GreenHeatmapModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapDataRef = useRef<PuttingMapData | null>(null);
  const greenRingRef = useRef<[number, number][] | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !courseId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadHeatmap() {
      try {
        const response = await fetch(
          `/api/golf/courses/${courseId}/holes/${holeNumber}/heatmap`
        );
        if (!response.ok) {
          throw new Error("Putting read unavailable for this hole.");
        }

        const data = (await response.json()) as HeatmapResponse;
        if (cancelled) return;

        const bounds = boundsFromGeoJson(data.bounds);
        if (!bounds) {
          throw new Error("Green bounds missing for this hole.");
        }

        mapDataRef.current = {
          gridWidth: data.gridWidth,
          gridHeight: data.gridHeight,
          elevation: data.elevation,
          slope: data.slope,
          bounds,
        };
        greenRingRef.current = extractGreenRing(features);
      } catch (loadError) {
        if (!cancelled) {
          mapDataRef.current = null;
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load putting read."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHeatmap();

    return () => {
      cancelled = true;
    };
  }, [open, courseId, holeNumber, features]);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    const container = containerRef.current;

    function render() {
      const canvas = canvasRef.current;
      const mapData = mapDataRef.current;
      if (!canvas || !mapData) return;

      const rect = container.getBoundingClientRect();
      const width = Math.max(Math.floor(rect.width), 1);
      const height = Math.max(Math.floor(rect.height), 1);
      sizeRef.current = { width, height };

      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.floor(width * dpr);
      const pixelHeight = Math.floor(height * dpr);

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPuttingGreenMap(
        ctx,
        width,
        height,
        mapData,
        greenRingRef.current,
        targets
      );
    }

    render();

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [open, loading, error, targets, holeNumber]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close putting read"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />

      <div className="absolute inset-x-0 bottom-0 flex h-[82dvh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0f1712] shadow-2xl">
        <div className="relative shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Putting read
              </p>
              <h2 className="mt-1 font-heading text-2xl font-semibold text-white">
                Hole {holeNumber} green
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Arrows show break direction. Brighter areas are steeper.
              </p>
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
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 shadow-inner">
            {loading && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-white/55">
                Loading putting read…
              </p>
            )}
            {error && (
              <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-300">
                {error}
              </p>
            )}
            {!loading && !error && (
              <div ref={containerRef} className="hole-diagram-container absolute inset-0">
                <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
              </div>
            )}
          </div>

          <div className="shrink-0 rounded-2xl border border-white/10 bg-black/55 px-3 py-2.5 text-xs text-white/55 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Contour lines = elevation change</span>
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-amber-400" />
                  F
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-white" />
                  Pin
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-orange-500" />
                  B
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
