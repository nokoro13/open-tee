"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { playerInitials } from "@/components/public/mobile-scoring-ui";
import type { HoleScoreEntry, HoleScoreStatus } from "@/lib/score-entry-utils";
import { ScoreParMark } from "@/components/public/score-par-mark";
import { cn } from "@/lib/utils";

type ScorecardView = "all" | string;

type ScorecardGridProps = {
  activeHole: number;
  holes: HoleScoreStatus[];
  onSelectHole: (hole: number) => void;
  readOnly?: boolean;
  className?: string;
  compact?: boolean;
  fillHeight?: boolean;
  showHeader?: boolean;
  showPlayerLegend?: boolean;
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

function holesForPlayer(
  holes: HoleScoreStatus[],
  playerId: string
): HoleScoreStatus[] {
  return holes.map((hole) => {
    const entry = hole.entries?.find((e) => e.id === playerId);
    return {
      ...hole,
      strokes: entry?.strokes,
      entries: undefined,
    };
  });
}

function playerThruTotal(holes: HoleScoreStatus[], playerId: string): number | null {
  let total = 0;
  let count = 0;
  for (const hole of holes) {
    const strokes = hole.entries?.find((e) => e.id === playerId)?.strokes;
    if (strokes != null) {
      total += strokes;
      count += 1;
    }
  }
  return count > 0 ? total : null;
}

function PlayerTabs({
  players,
  view,
  onViewChange,
  compact,
}: {
  players: HoleScoreEntry[];
  view: ScorecardView;
  onViewChange: (view: ScorecardView) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-1.5 overflow-x-auto pb-0.5",
        compact ? "mt-2" : "mt-2.5"
      )}
      role="tablist"
      aria-label="Scorecard players"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "all"}
        onClick={() => onViewChange("all")}
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
          view === "all"
            ? "border-primary bg-primary text-primary-foreground shadow-sm"
            : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
        )}
      >
        All
      </button>
      {players.map((player) => (
        <button
          key={player.id}
          type="button"
          role="tab"
          aria-selected={view === player.id}
          onClick={() => onViewChange(player.id)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            view === player.id
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
          )}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[9px] font-bold",
              view === player.id
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-primary/10 text-primary"
            )}
          >
            {playerInitials(player.label).slice(0, 1)}
          </span>
          {player.label.split(" ")[0]}
        </button>
      ))}
    </div>
  );
}

function SingleHoleScore({
  hole,
  compact,
  fillHeight,
}: {
  hole: HoleScoreStatus;
  compact?: boolean;
  fillHeight?: boolean;
}) {
  return (
    <>
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
    </>
  );
}

function MultiHoleScore({
  hole,
  compact,
}: {
  hole: HoleScoreStatus;
  compact?: boolean;
}) {
  if (!hole.entries) return null;

  return (
    <div className="flex w-full flex-col items-center gap-px">
      {hole.entries.map((entry, index) => (
        <div
          key={entry.id}
          className={cn(
            "flex items-center gap-0.5 tabular-nums leading-none",
            compact ? "text-[11px]" : "text-xs",
            index > 0 && "text-muted-foreground"
          )}
        >
          <span className="w-3 text-[8px] font-bold uppercase text-muted-foreground/80">
            {playerInitials(entry.label).slice(0, 1)}
          </span>
          {entry.strokes != null && hole.par != null ? (
            <ScoreParMark
              strokes={entry.strokes}
              par={hole.par}
              compact
              className={compact ? "text-[11px]" : "text-xs"}
            >
              {entry.strokes}
            </ScoreParMark>
          ) : (
            <span className="font-semibold">{entry.strokes ?? "·"}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function ScorecardGrid({
  activeHole,
  holes,
  onSelectHole,
  readOnly,
  className,
  compact,
  fillHeight,
  showHeader = true,
  showPlayerLegend = false,
}: ScorecardGridProps) {
  const players = holes[0]?.entries ?? [];
  const multiPlayer = players.length > 1;
  const [view, setView] = useState<ScorecardView>("all");

  const showAllView = multiPlayer && view === "all";
  const selectedPlayer = players.find((p) => p.id === view);
  const displayHoles =
    showAllView || !multiPlayer
      ? holes
      : view !== "all"
        ? holesForPlayer(holes, view)
        : holes;

  const isNine = holes.length <= 9;
  const rowCount = isNine ? 3 : 3;
  const parTotal = holes.reduce((sum, h) => sum + (h.par ?? 0), 0);
  const scoredCount = holes.filter((h) => h.saved).length;

  const scoredTotal = showAllView
    ? null
    : selectedPlayer
      ? playerThruTotal(holes, selectedPlayer.id)
      : holes.reduce((sum, h) => sum + (h.strokes ?? 0), 0);

  const thruCount = showAllView
    ? scoredCount
    : displayHoles.filter((h) => h.strokes != null).length;

  return (
    <div
      className={cn(
        "flex flex-col",
        fillHeight && "min-h-0 flex-1",
        className
      )}
    >
      {(showHeader || showPlayerLegend) && (
        <div className={cn("shrink-0", compact ? "mb-2" : "mb-3")}>
          {showHeader && (
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>
                  {selectedPlayer && view !== "all"
                    ? `${selectedPlayer.label.split(" ")[0]}'s scorecard`
                    : "Scorecard"}
                </h3>
                <p className="text-[10px] text-muted-foreground sm:text-xs">
                  {scoredCount} of {holes.length} holes saved
                </p>
              </div>
              {scoredTotal != null && thruCount > 0 && (
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
                    Thru {thruCount}
                  </p>
                </div>
              )}
            </div>
          )}

          {multiPlayer && (showHeader || showPlayerLegend) && (
            <PlayerTabs
              players={players}
              view={view}
              onViewChange={setView}
              compact={compact}
            />
          )}

          {!showHeader && multiPlayer && view !== "all" && selectedPlayer && scoredTotal != null && (
            <p className="mt-2 text-sm font-medium tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">
                {selectedPlayer.label.split(" ")[0]}
              </span>
              {" · "}
              {scoredTotal} thru {thruCount}
            </p>
          )}
        </div>
      )}

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
          showAllView && !fillHeight && "grid-cols-3",
          !showAllView &&
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
        {displayHoles.map((hole) => (
          <button
            key={hole.hole}
            type="button"
            disabled={readOnly && !hole.saved}
            onClick={() => onSelectHole(hole.hole)}
            className={cn(
              "group flex flex-col items-center justify-center rounded-lg border transition-all",
              compact ? "px-1 py-1" : "rounded-xl px-1.5 py-2.5",
              showAllView && "min-h-[3.25rem] py-2",
              fillHeight && compact && "h-full min-h-0 py-2",
              !compact && !showAllView && "py-3",
              activeHole === hole.hole
                ? "border-primary bg-primary/10 ring-2 ring-primary/25 shadow-sm"
                : hole.saved
                  ? cn(
                      "hover:scale-[1.02] hover:shadow-sm",
                      !showAllView && scoreTone(hole.strokes, hole.par)
                    )
                  : "border-dashed border-border/80 bg-background hover:border-border hover:bg-muted/20",
              hole.saved && showAllView && "border-border bg-muted/20"
            )}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {hole.hole}
            </span>
            {showAllView ? (
              <MultiHoleScore hole={hole} compact={compact} />
            ) : (
              <SingleHoleScore
                hole={hole}
                compact={compact}
                fillHeight={fillHeight}
              />
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

  const multiPlayer = (gridProps.holes[0]?.entries?.length ?? 0) > 1;
  const scoredCount = gridProps.holes.filter((h) => h.saved).length;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close scorecard"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="shrink-0">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <div>
              <h2 className="text-lg font-semibold">Scorecard</h2>
              <p className="text-xs text-muted-foreground">
                {scoredCount} of {gridProps.holes.length} holes saved
                {multiPlayer ? " · tap a player to filter" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <ScorecardGrid
            {...gridProps}
            showHeader={false}
            showPlayerLegend={multiPlayer}
          />
          <p className="mt-4 pb-2 text-center text-xs text-muted-foreground">
            Tap a hole to jump and edit
          </p>
        </div>
      </div>
    </div>
  );
}
