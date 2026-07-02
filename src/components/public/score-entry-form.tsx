"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  LayoutGrid,
  Trophy,
} from "lucide-react";

import { saveHoleScores } from "@/actions/scoring";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScorecardGrid,
  ScorecardOverlay,
} from "@/components/public/scorecard-grid";
import {
  getDefaultScoreForHole,
  ScoreStepper,
} from "@/components/public/score-stepper";
import type { RunningScore } from "@/lib/score-entry-utils";
import type { ScoreEntryGroup } from "@/lib/scoring";
import {
  computeRunningScores,
  countCompletedHoles,
  findStartingHoleIndex,
  getHoleStatuses,
  isRoundComplete,
} from "@/lib/score-entry-utils";
import {
  getEventFormatLabel,
  getScoreEntrySubtitle,
  isTeamHoleScoring,
} from "@/lib/event-formats";
import {
  getScorePageHref,
  saveScoringCode,
} from "@/lib/scoring-code-storage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ScoreEntryFormProps = {
  slug: string;
  code: string;
  eventName: string;
  format: string;
  holes: "9" | "18";
  holeNumbers: number[];
  parByHole: Record<number, number>;
  groups: ScoreEntryGroup[];
  initialScores: Record<string, Record<number, number>>;
  readOnly: boolean;
};

type SlideDirection = "forward" | "back";

function RunningScoreCard({
  running,
  compact,
}: {
  running: RunningScore;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card shadow-sm",
        compact ? "p-3" : "p-4"
      )}
    >
      <p
        className={cn(
          "truncate font-medium text-muted-foreground",
          compact ? "text-xs" : "text-sm"
        )}
      >
        {running.label}
      </p>
      <div className={cn("grid grid-cols-3", compact ? "mt-2 gap-2" : "mt-3 gap-3")}>
        <div>
          <p
            className={cn(
              "font-semibold tabular-nums leading-none tracking-tight",
              compact ? "text-2xl" : "text-3xl sm:text-4xl"
            )}
          >
            {running.total ?? "—"}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Total
          </p>
        </div>
        {running.toParDisplay ? (
          <div className="text-center">
            <p
              className={cn(
                "font-semibold tabular-nums leading-none tracking-tight",
                compact ? "text-2xl" : "text-3xl sm:text-4xl",
                running.toPar != null && running.toPar < 0 && "text-primary"
              )}
            >
              {running.toParDisplay}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              vs par
            </p>
          </div>
        ) : (
          <div />
        )}
        <div className="text-right">
          <p
            className={cn(
              "font-semibold tabular-nums leading-none tracking-tight",
              compact ? "text-2xl" : "text-3xl sm:text-4xl"
            )}
          >
            {running.thru}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Thru
          </p>
        </div>
      </div>
    </div>
  );
}

export function ScoreEntryForm({
  slug,
  code,
  eventName,
  format,
  holes,
  holeNumbers,
  parByHole,
  groups,
  initialScores,
  readOnly,
}: ScoreEntryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>("forward");

  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? "");
  const [scores, setScores] = useState(initialScores);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const scoreEntries =
    selectedGroup && isTeamHoleScoring(format, selectedGroup.matchType)
      ? selectedGroup.entrySides.map((side) => ({
          id: side.id,
          label: side.label,
        }))
      : (selectedGroup?.players.map((player) => ({
          id: player.id,
          label: player.name,
        })) ?? []);

  const entryIds = scoreEntries.map((e) => e.id);

  const [activeHoleIndex, setActiveHoleIndex] = useState(() =>
    findStartingHoleIndex(holeNumbers, entryIds, initialScores)
  );

  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    saveScoringCode(slug, code);
  }, [slug, code]);

  const activeHole = holeNumbers[activeHoleIndex] ?? 1;
  const activePar = parByHole[activeHole];
  const totalHoles = holeNumbers.length;
  const completedHoles = countCompletedHoles(holeNumbers, entryIds, scores);
  const roundComplete = isRoundComplete(holeNumbers, entryIds, scores);
  const progressPct = Math.round((completedHoles / totalHoles) * 100);

  const runningScores = computeRunningScores(
    scoreEntries,
    scores,
    holeNumbers,
    parByHole
  );

  const holeStatuses = getHoleStatuses(
    holeNumbers,
    entryIds,
    scores,
    parByHole,
    entryIds[0] ?? ""
  );

  const getEffectiveScore = useCallback(
    (entityId: string, hole: number) => {
      const stored = scores[entityId]?.[hole];
      if (stored != null) return stored;
      return getDefaultScoreForHole(parByHole, hole);
    },
    [scores, parByHole]
  );

  function setScore(entityId: string, hole: number, value: number) {
    setScores((prev) => ({
      ...prev,
      [entityId]: { ...prev[entityId], [hole]: value },
    }));
  }

  function navigateToIndex(index: number, direction: SlideDirection) {
    if (index < 0 || index >= totalHoles) return;
    setSlideDirection(direction);
    setActiveHoleIndex(index);
    setError(null);
    setJustSaved(false);
  }

  function handleGroupChange(groupId: string) {
    const newGroup = groups.find((g) => g.id === groupId);
    if (!newGroup) return;

    const newEntries = isTeamHoleScoring(format, newGroup.matchType)
      ? newGroup.entrySides.map((s) => s.id)
      : newGroup.players.map((p) => p.id);

    setSelectedGroupId(groupId);
    setActiveHoleIndex(findStartingHoleIndex(holeNumbers, newEntries, scores));
    setError(null);
    setJustSaved(false);
  }

  function handleSave() {
    if (!selectedGroup || readOnly) return;

    setError(null);
    setJustSaved(false);

    const teamEntry = isTeamHoleScoring(format, selectedGroup.matchType);
    let payload;

    if (teamEntry) {
      payload = selectedGroup.entrySides.map((side) => {
        const teamSide: "a" | "b" | "team" =
          side.teamSide === "a" || side.teamSide === "b" ? side.teamSide : "team";
        return {
          pairingGroupId: selectedGroup.id,
          teamSide,
          strokes: getEffectiveScore(side.id, activeHole),
        };
      });
    } else {
      payload = selectedGroup.players.map((player) => ({
        registrationId: player.id,
        strokes: getEffectiveScore(player.id, activeHole),
      }));
    }

    startTransition(async () => {
      const result = await saveHoleScores({
        slug,
        code,
        holeNumber: activeHole,
        format,
        matchType: selectedGroup.matchType,
        groupId: selectedGroup.id,
        scores: payload,
      });

      if (!result.success) {
        setError(result.error ?? "Could not save scores.");
        return;
      }

      const nextScores = { ...scores };
      if (teamEntry) {
        for (const side of selectedGroup.entrySides) {
          const val = getEffectiveScore(side.id, activeHole);
          nextScores[side.id] = { ...nextScores[side.id], [activeHole]: val };
        }
      } else {
        for (const player of selectedGroup.players) {
          const val = getEffectiveScore(player.id, activeHole);
          nextScores[player.id] = { ...nextScores[player.id], [activeHole]: val };
        }
      }
      setScores(nextScores);
      setJustSaved(true);
      router.refresh();

      if (activeHoleIndex < totalHoles - 1) {
        setTimeout(() => navigateToIndex(activeHoleIndex + 1, "forward"), 450);
      }
    });
  }

  function handleTouchStart(clientX: number) {
    touchStartX.current = clientX;
  }

  function handleTouchEnd(clientX: number) {
    if (touchStartX.current == null || readOnly || isPending) return;
    const diff = touchStartX.current - clientX;
    touchStartX.current = null;
    if (Math.abs(diff) < 48) return;
    if (diff > 0 && activeHoleIndex < totalHoles - 1) {
      navigateToIndex(activeHoleIndex + 1, "forward");
    } else if (diff < 0 && activeHoleIndex > 0) {
      navigateToIndex(activeHoleIndex - 1, "back");
    }
  }

  function handleSelectHole(hole: number) {
    const index = holeNumbers.indexOf(hole);
    if (index >= 0) {
      navigateToIndex(index, index > activeHoleIndex ? "forward" : "back");
    }
  }

  if (groups.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/20 p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground shadow-sm">
          No players or groups yet. Add registrations and pairings before scoring.
        </div>
      </div>
    );
  }

  const slideClass =
    slideDirection === "forward"
      ? "animate-in slide-in-from-right-8 fade-in duration-300"
      : "animate-in slide-in-from-left-8 fade-in duration-300";

  const scorecardProps = {
    activeHole,
    holes: holeStatuses,
    readOnly,
    onSelectHole: handleSelectHole,
  };

  const actionBar = (
    <div className="flex items-center gap-2 sm:gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 shrink-0 rounded-full sm:size-11"
        disabled={isPending || activeHoleIndex <= 0}
        onClick={() => navigateToIndex(activeHoleIndex - 1, "back")}
        aria-label="Previous hole"
      >
        <ChevronLeft className="size-5" />
      </Button>

      <Button
        type="button"
        variant="outline"
        className="size-10 shrink-0 px-2.5 lg:hidden sm:px-3"
        onClick={() => setShowScorecard(true)}
      >
        <LayoutGrid className="size-4" />
        <span className="sr-only">Scorecard</span>
      </Button>

      {!readOnly ? (
        <Button
          type="button"
          size="lg"
          className="h-10 min-w-0 flex-1 text-sm sm:h-11 sm:text-base"
          disabled={isPending}
          onClick={handleSave}
        >
          {isPending ? (
            "Saving..."
          ) : activeHoleIndex < totalHoles - 1 ? (
            <>
              <span className="sm:hidden">Confirm · Next</span>
              <span className="hidden sm:inline">
                Confirm · Hole {activeHole + 1} next
              </span>
            </>
          ) : (
            "Confirm · Finish round"
          )}
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="h-11 flex-1"
          disabled={activeHoleIndex >= totalHoles - 1}
          onClick={() => navigateToIndex(activeHoleIndex + 1, "forward")}
        >
          Next hole
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 shrink-0 rounded-full sm:size-11"
        disabled={isPending || activeHoleIndex >= totalHoles - 1}
        onClick={() => navigateToIndex(activeHoleIndex + 1, "forward")}
        aria-label="Next hole"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-gradient-to-b from-muted/40 via-background to-muted/20">
      {/* Header */}
      <header className="z-30 shrink-0 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-2 px-4 lg:h-14 sm:gap-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Flag className="size-4" />
            </div>
            <span className="hidden font-heading text-sm font-semibold sm:inline">
              OpenTee
            </span>
          </Link>

          <div className="min-w-0 flex-1 lg:hidden">
            <p className="truncate font-semibold tracking-tight">{eventName}</p>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {getScoreEntrySubtitle(format, selectedGroup?.matchType)}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full bg-muted px-3 py-1 text-xs font-medium tabular-nums sm:inline">
              Hole {activeHoleIndex + 1} / {totalHoles}
            </span>

            <ButtonLink
              href={`/e/${slug}/leaderboard`}
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Trophy className="size-4" />
              Leaderboard
            </ButtonLink>
            <Link
              href={`/e/${slug}/leaderboard`}
              className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-primary/10 sm:hidden"
              aria-label="Leaderboard"
            >
              <Trophy className="size-5" />
            </Link>
          </div>
        </div>

        {/* Progress — mobile */}
        <div className="border-t border-border/50 px-4 pb-2 pt-1.5 lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {progressPct}%
            </span>
          </div>
        </div>
      </header>

      {readOnly && (
        <div className="mx-auto w-full max-w-6xl shrink-0 px-4 pt-2 sm:px-6 lg:pt-2">
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-center text-xs text-muted-foreground lg:py-2">
            Scoring is finalized — view only
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 overflow-hidden px-4 py-2 sm:gap-6 sm:px-6 sm:py-3 lg:grid lg:grid-cols-[minmax(280px,320px)_1fr] lg:gap-5 lg:py-4">
        {/* Sidebar — desktop */}
        <aside className="hidden min-h-0 flex-col gap-3 overflow-hidden lg:flex">
          <div className="shrink-0 space-y-1.5">
            <h1 className="text-lg font-semibold leading-tight tracking-tight">
              {eventName}
            </h1>
            <p className="text-xs text-muted-foreground">
              {getScoreEntrySubtitle(format, selectedGroup?.matchType)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">
                {getEventFormatLabel(format)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {holes} holes
              </Badge>
            </div>
          </div>

          <div className="shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Progress
              </p>
              <span className="text-sm font-medium tabular-nums">
                {completedHoles}/{totalHoles}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="shrink-0 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Group
            </label>
            <Select
              value={selectedGroupId}
              disabled={isPending}
              onValueChange={(value) => value && handleGroupChange(value)}
            >
              <SelectTrigger className="h-9 w-full bg-card">
                <SelectValue placeholder="Select group">
                  {selectedGroup?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.label}
                    {group.players.length > 1
                      ? ` (${group.players.length} players)`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="shrink-0 space-y-2">
            {runningScores.map((running) => (
              <RunningScoreCard key={running.id} running={running} compact />
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
            <ScorecardGrid {...scorecardProps} compact fillHeight />
          </div>
        </aside>

        {/* Mobile stats + group */}
        <div className="shrink-0 space-y-2 lg:hidden">
          <Select
            value={selectedGroupId}
            disabled={isPending}
            onValueChange={(value) => value && handleGroupChange(value)}
          >
            <SelectTrigger className="h-9 w-full bg-card">
              <SelectValue placeholder="Select group">
                {selectedGroup?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            className={cn(
              "grid gap-2",
              runningScores.length > 1 ? "grid-cols-2" : "grid-cols-1"
            )}
          >
            {runningScores.map((running) => (
              <RunningScoreCard key={running.id} running={running} />
            ))}
          </div>
        </div>

        {/* Hole entry */}
        <section
          className="flex min-h-0 flex-1 flex-col"
          onTouchStart={(e) => handleTouchStart(e.touches[0]?.clientX ?? 0)}
          onTouchEnd={(e) => handleTouchEnd(e.changedTouches[0]?.clientX ?? 0)}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.02]">
            {roundComplete && !readOnly ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 text-center sm:px-6 sm:py-12">
                <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner">
                  <Check className="size-10" strokeWidth={2.5} />
                </div>
                <h2 className="mt-6 font-heading text-2xl font-semibold tracking-tight">
                  Round complete
                </h2>
                <p className="mt-2 max-w-sm text-muted-foreground">
                  All {totalHoles} holes scored for {selectedGroup?.label}
                </p>
                <div className="mt-6 space-y-2">
                  {runningScores.map((running) => (
                    <p
                      key={running.id}
                      className="text-lg font-medium tabular-nums"
                    >
                      {running.label}: {running.total}
                      {running.toParDisplay ? ` (${running.toParDisplay})` : ""}
                    </p>
                  ))}
                </div>
                <ButtonLink
                  href={`/e/${slug}/leaderboard`}
                  size="lg"
                  className="mt-8 h-12 px-10"
                >
                  View leaderboard
                </ButtonLink>
                <button
                  type="button"
                  onClick={() => setShowScorecard(true)}
                  className="mt-4 text-sm text-primary underline-offset-4 hover:underline lg:hidden"
                >
                  Review scorecard
                </button>
              </div>
            ) : (
              <>
                <div
                  key={`hole-${activeHole}-${slideDirection}`}
                  className={cn(
                    "flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-8 sm:py-6 lg:py-4",
                    slideClass
                  )}
                >
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
                      Current hole
                    </p>

                    <div className="mt-2 flex items-baseline gap-2 sm:mt-3 sm:gap-3">
                      <span className="font-heading text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl lg:text-7xl">
                        {activeHole}
                      </span>
                      <span className="text-base text-muted-foreground sm:text-lg">
                        / {totalHoles}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground lg:text-base">
                      {activePar != null ? (
                        <>Par {activePar}</>
                      ) : (
                        <>Default par {getDefaultScoreForHole(parByHole, activeHole)}</>
                      )}
                    </p>

                    <div
                      className={cn(
                        "mt-4 grid w-full max-w-lg gap-4 sm:mt-6 sm:gap-6 lg:mt-8 lg:gap-8",
                        scoreEntries.length > 1
                          ? "grid-cols-2 sm:grid-cols-2"
                          : "grid-cols-1 place-items-center"
                      )}
                    >
                      {scoreEntries.map((entry) => (
                        <ScoreStepper
                          key={entry.id}
                          label={entry.label}
                          value={getEffectiveScore(entry.id, activeHole)}
                          par={activePar}
                          disabled={readOnly || isPending}
                          size="large"
                          onChange={(value) =>
                            setScore(entry.id, activeHole, value)
                          }
                        />
                      ))}
                    </div>

                    {justSaved && (
                      <div className="mt-3 flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary animate-in fade-in duration-200 sm:mt-8 sm:px-5 sm:py-2.5 sm:text-sm">
                        <Check className="size-3.5 sm:size-4" />
                        Hole {activeHole} saved
                      </div>
                    )}

                    {error && (
                      <p
                        className="mt-3 text-center text-sm text-destructive sm:mt-6"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                  </div>
                </div>

                {/* Desktop footer inside card */}
                {!roundComplete && (
                  <div className="hidden shrink-0 border-t border-border/60 bg-muted/20 px-6 py-3 lg:block">
                    {actionBar}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Mobile footer */}
      {!roundComplete && (
        <footer className="z-30 shrink-0 border-t border-border/80 bg-background/95 px-4 py-2 backdrop-blur-md sm:py-3 lg:hidden">
          <div className="mx-auto max-w-lg">{actionBar}</div>
        </footer>
      )}

      <ScorecardOverlay
        open={showScorecard}
        onClose={() => setShowScorecard(false)}
        {...scorecardProps}
      />
    </div>
  );
}

type ScoringCodeFormProps = {
  slug: string;
};

export function ScoringCodeForm({ slug }: ScoringCodeFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    saveScoringCode(slug, trimmed);
    router.push(getScorePageHref(slug, trimmed));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-muted/30 px-6 py-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Flag className="size-7" />
        </div>
        <h2 className="mt-4 font-heading text-xl font-semibold tracking-tight">
          Enter scoring code
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask the organizer for the code to enter scores
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC123"
          className="h-14 text-center text-xl tracking-[0.3em] uppercase"
          autoComplete="off"
          autoCapitalize="characters"
        />
        <Button type="submit" size="lg" className="h-12 w-full text-base">
          Continue to scorecard
        </Button>
      </form>
    </div>
  );
}

export function ScoringPageHeader({ slug }: { slug: string }) {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-4 sm:h-16 lg:max-w-2xl">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Flag className="size-4" />
          </div>
          <span className="font-heading text-base font-semibold">OpenTee</span>
        </Link>
        <span className="text-sm text-muted-foreground">· Scoring</span>
        <Link
          href={`/e/${slug}/leaderboard`}
          className="ml-auto text-sm text-primary underline-offset-4 hover:underline"
        >
          Leaderboard
        </Link>
      </div>
    </header>
  );
}
