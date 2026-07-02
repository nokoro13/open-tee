"use client";

import { X } from "lucide-react";

import type { HoleScoreStatus } from "@/lib/score-entry-utils";
import { ScoreParMark } from "@/components/public/score-par-mark";
import { cn } from "@/lib/utils";

type ScorecardGridProps = {
  activeHole: number;
  holes: HoleScoreStatus[];
  onSelectHole: (hole: number) => void;
  readOnly?: boolean;
  className?: string;
  compact?: boolean;
  fillHeight?: boolean;
};

function scoreTone(strokes: number | undefined, par: number | undefined): string {
  if (strokes == null || par == null) return "";
  const diff = strokes - par;
  if (diff <= -2) return "border-primary/40 bg-primary/15";
  if (diff === -1) return "border-primary/25 bg-primary/10";
  if (diff === 0) return "border-border bg-muted/30";
  if (diff === 1) return "border-border bg-muted/50";
  return "border-destructive/20 bg-destructive/5";
}

export function ScorecardGrid({
  activeHole,
  holes,
  onSelectHole,
  readOnly,
  className,
  compact,
  fillHeight,
}: ScorecardGridProps) {
  const isNine = holes.length <= 9;
  const rowCount = isNine ? 3 : 3;
  const parTotal = holes.reduce((sum, h) => sum + (h.par ?? 0), 0);
  const scoredTotal = holes.reduce((sum, h) => sum + (h.strokes ?? 0), 0);
  const scoredCount = holes.filter((h) => h.saved).length;

  return (
    <div
      className={cn(
        "flex flex-col",
        fillHeight && "min-h-0 flex-1",
        className
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-end justify-between gap-3",
          compact ? "mb-2" : "mb-3"
        )}
      >
        <div>
          <h3 className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>
            Scorecard
          </h3>
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            {scoredCount} of {holes.length} holes saved
          </p>
        </div>
        {parTotal > 0 && scoredCount > 0 && (
          <div className="text-right">
            <p
              className={cn(
                "font-semibold tabular-nums leading-none",
                compact ? "text-base" : "text-lg"
              )}
            >
              {scoredTotal}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Thru {scoredCount}
            </p>
          </div>
        )}
      </div>

      <div
        className={cn(
          "grid",
          fillHeight && compact
            ? isNine
              ? "grid-cols-3 flex-1 grid-rows-3"
              : "grid-cols-6 flex-1 grid-rows-3"
            : "content-start",
          !fillHeight && "min-h-0",
          fillHeight && compact ? "gap-1.5" : compact ? "gap-1" : "gap-2",
          !fillHeight &&
            (isNine
              ? compact
                ? "grid-cols-3"
                : "grid-cols-3 sm:grid-cols-9 lg:grid-cols-3"
              : compact
                ? "grid-cols-6"
                : "grid-cols-3 sm:grid-cols-6 lg:grid-cols-6")
        )}
        style={
          fillHeight && compact
            ? { gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {holes.map((hole) => (
          <button
            key={hole.hole}
            type="button"
            disabled={readOnly && !hole.saved}
            onClick={() => onSelectHole(hole.hole)}
            className={cn(
              "group flex flex-col items-center justify-center rounded-lg border transition-all",
              compact ? "px-1 py-1" : "rounded-xl px-1.5 py-2.5",
              fillHeight && compact && "h-full min-h-0 py-2",
              !compact && "py-3",
              activeHole === hole.hole
                ? "border-primary bg-primary/10 ring-2 ring-primary/25 shadow-sm"
                : hole.saved
                  ? cn("hover:scale-[1.02] hover:shadow-sm", scoreTone(hole.strokes, hole.par))
                  : "border-dashed border-border/80 bg-background hover:border-border hover:bg-muted/20"
            )}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {hole.hole}
            </span>
            <span
              className={cn(
                "mt-0.5 font-semibold tabular-nums",
                compact ? "text-sm leading-none" : "text-lg",
                fillHeight && compact && "text-base",
                hole.strokes != null && hole.par != null && "inline-flex items-center justify-center"
              )}
            >
              {hole.strokes != null && hole.par != null ? (
                <ScoreParMark
                  strokes={hole.strokes}
                  par={hole.par}
                  compact={compact}
                  className={cn(
                    compact ? "text-sm leading-none" : "text-lg",
                    fillHeight && compact && "text-base"
                  )}
                >
                  {hole.strokes}
                </ScoreParMark>
              ) : (
                hole.strokes ?? "·"
              )}
            </span>
            {hole.par != null && (
              <span className="mt-0.5 text-[9px] leading-none text-muted-foreground">
                {hole.par}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

type ScorecardOverlayProps = ScorecardGridProps & {
  open: boolean;
  onClose: () => void;
};

export function ScorecardOverlay({
  open,
  onClose,
  ...gridProps
}: ScorecardOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close scorecard"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">Scorecard</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 pb-8">
          <ScorecardGrid {...gridProps} />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Tap a hole to jump and edit
          </p>
        </div>
      </div>
    </div>
  );
}
