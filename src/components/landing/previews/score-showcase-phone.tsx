"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  LayoutGrid,
  Trophy,
} from "lucide-react";

import {
  MobileContextBar,
  MobileHoleHero,
} from "@/components/public/mobile-scoring-ui";
import {
  getDefaultScoreForHole,
  ScoreStepper,
} from "@/components/public/score-stepper";
import { PreviewPhoneFrame } from "@/components/landing/preview-phone-frame";
import { PreviewScale } from "@/components/landing/preview-scale";
import { Button } from "@/components/ui/button";
import { getScoreEntrySubtitle } from "@/lib/event-formats";
import { computeRunningScores } from "@/lib/score-entry-utils";
import {
  PHONE_NATIVE_WIDTH,
  SHOWCASE_SCORE_NATIVE_HEIGHT,
  SHOWCASE_STROKE_EVENT,
  showcaseParByHole,
  showcaseStrokeGroup,
  showcaseStrokeHoleNumbers,
  showcaseStrokeInitialScores,
} from "@/lib/showcase-stroke-data";

const ACTIVE_HOLE = 10;

function ScoreShowcaseContent() {
  const [scores, setScores] = useState(showcaseStrokeInitialScores);

  const scoreEntries = useMemo(
    () =>
      showcaseStrokeGroup.players.map((player) => ({
        id: player.id,
        label: player.name,
      })),
    []
  );

  const activeHole = ACTIVE_HOLE;
  const activePar = showcaseParByHole[activeHole] ?? 4;
  const totalHoles = showcaseStrokeHoleNumbers.length;
  const completedHoles = 9;
  const progressPct = Math.round((activeHole / totalHoles) * 100);

  const runningScores = useMemo(
    () =>
      computeRunningScores(
        scoreEntries,
        scores,
        showcaseStrokeHoleNumbers,
        showcaseParByHole
      ),
    [scoreEntries, scores]
  );

  function getScore(playerId: string) {
    return scores[playerId]?.[activeHole] ?? getDefaultScoreForHole(showcaseParByHole, activeHole);
  }

  function setScore(playerId: string, value: number) {
    setScores((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [activeHole]: value },
    }));
  }

  return (
    <div
      className="flex flex-col overflow-hidden bg-background text-foreground"
      style={{
        width: PHONE_NATIVE_WIDTH,
        height: SHOWCASE_SCORE_NATIVE_HEIGHT,
      }}
    >
      <header className="z-30 shrink-0 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="flex h-12 items-center gap-2 px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Flag className="size-4" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold tracking-tight text-foreground">
              {SHOWCASE_STROKE_EVENT.eventName}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {getScoreEntrySubtitle(SHOWCASE_STROKE_EVENT.format, null)}
            </p>
          </div>

          <div className="flex size-10 items-center justify-center rounded-full text-primary">
            <Trophy className="size-5" />
          </div>
        </div>

        <div className="border-t border-border/50 px-4 pb-2.5 pt-2">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {activeHole}/{totalHoles}
            </span>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 py-2">
        <MobileContextBar
          allowGroupSwitch={false}
          selectedGroupId={showcaseStrokeGroup.id}
          selectedGroup={showcaseStrokeGroup}
          groups={[showcaseStrokeGroup]}
          isPending={false}
          onGroupChange={() => undefined}
          matchRunningScore={null}
          runningScores={runningScores}
          completedHoles={completedHoles}
          totalHoles={totalHoles}
          onOpenDetails={() => undefined}
        />

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-md">
            <MobileHoleHero
              activeHole={activeHole}
              totalHoles={totalHoles}
              par={activePar}
            />

            <div className="relative flex min-h-0 flex-1 flex-col justify-center divide-y divide-border/40 overflow-hidden">
              {scoreEntries.map((entry, index) => (
                <ScoreStepper
                  key={entry.id}
                  label={entry.label}
                  value={getScore(entry.id)}
                  par={activePar}
                  size="large"
                  layout="responsive"
                  forceMobileLayout
                  playerIndex={index}
                  onChange={(value) => setScore(entry.id, value)}
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="z-30 mt-auto shrink-0 border-t border-border/80 bg-none px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 shrink-0 rounded-full"
            aria-label="Previous hole"
          >
            <ChevronLeft className="size-5" />
          </Button>

          <Button type="button" variant="outline" className="size-10 shrink-0 px-2.5">
            <LayoutGrid className="size-4" />
            <span className="sr-only">Scorecard</span>
          </Button>

          <Button
            type="button"
            size="lg"
            className="h-10 min-w-0 flex-1 text-sm font-semibold"
          >
            Confirm · Next
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 shrink-0 rounded-full"
            aria-label="Next hole"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

export function ScoreShowcasePhone({ className }: { className?: string }) {
  return (
    <PreviewPhoneFrame className={className}>
      <PreviewScale
        nativeWidth={PHONE_NATIVE_WIDTH}
        nativeHeight={SHOWCASE_SCORE_NATIVE_HEIGHT}
        fit="contain"
        interactive
        className="h-full w-full"
      >
        <ScoreShowcaseContent />
      </PreviewScale>
    </PreviewPhoneFrame>
  );
}
