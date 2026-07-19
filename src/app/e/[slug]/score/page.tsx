import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getHoleNumbers,
  getScoreEntryGroups,
  getScoresForEvent,
  getPublishedEventForScoring,
  isScoringEditable,
  resolveScoringAccess,
  scoresToMap,
} from "@/lib/scoring";
import { getCaddieContextForEvent } from "@/lib/golf-courses";
import {
  ScoreEntryForm,
  ScoringCodeForm,
  ScoringPageHeader,
} from "@/components/public/score-entry-form";
import { ScoringSessionRestore } from "@/components/public/scoring-session-restore";

type ScorePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string }>;
};

function ScorePageShell({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-linear-to-b from-muted/40 via-background to-muted/20">
      <ScoringPageHeader slug={slug} />
      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-lg items-center px-4 py-8 sm:max-w-md lg:max-w-lg lg:py-12">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}

export default async function ScorePage({ params, searchParams }: ScorePageProps) {
  const { slug } = await params;
  const { code } = await searchParams;
  const event = await getPublishedEventForScoring(slug);

  if (!event) {
    notFound();
  }

  if (event.scoringStatus === "disabled") {
    return (
      <ScorePageShell slug={slug}>
        <div className="rounded-2xl border border-border/70 bg-card px-6 py-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Scoring has not been opened for this event yet.
          </p>
          <Link
            href={`/e/${slug}`}
            className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Back to event
          </Link>
        </div>
      </ScorePageShell>
    );
  }

  if (!code) {
    return (
      <ScorePageShell slug={slug}>
        <ScoringSessionRestore slug={slug} />
        <ScoringCodeForm slug={slug} />
      </ScorePageShell>
    );
  }

  const access = await resolveScoringAccess(event.id, event, code);
  if (!access) {
    return (
      <ScorePageShell slug={slug}>
        <div className="space-y-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Invalid scoring code. Check with the organizer and try again.
          </div>
          <ScoringCodeForm slug={slug} />
        </div>
      </ScorePageShell>
    );
  }

  const allGroups = await getScoreEntryGroups(event.id, event.format);
  const allowGroupSwitch = access.type === "marshal";
  const visibleGroups =
    access.type === "group"
      ? allGroups.filter((group) => group.id === access.groupId)
      : allGroups;

  if (visibleGroups.length === 0) {
    return (
      <ScorePageShell slug={slug}>
        <div className="rounded-2xl border border-border/70 bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
          No players or groups are available for this scoring code yet. Ask the
          organizer to confirm your pairing assignment.
        </div>
      </ScorePageShell>
    );
  }

  const [scores] = await Promise.all([getScoresForEvent(event.id)]);

  const scoreMap = scoresToMap(
    scores,
    event.format,
    allGroups.map((g) => ({ id: g.id, matchType: g.matchType ?? null }))
  );
  const initialScores: Record<string, Record<number, number>> = {};
  for (const [key, holes] of scoreMap.entries()) {
    initialScores[key] = Object.fromEntries(holes.entries());
  }

  const readOnly = !isScoringEditable(event.scoringStatus);

  const parByHole = Object.fromEntries(
    (event.eventHoles ?? []).map((hole) => [hole.holeNumber, hole.par])
  );
  const yardageByHole = Object.fromEntries(
    (event.eventHoles ?? [])
      .filter((hole) => hole.yardage != null)
      .map((hole) => [hole.holeNumber, hole.yardage!])
  );

  const holeNumbers = getHoleNumbers(event.holes);
  const caddieContext = await getCaddieContextForEvent({
    externalCourseId: event.externalCourseId,
    selectedTeeKey: event.selectedTeeKey,
    holes: event.holes,
    nineSide: event.nineSide,
    holeNumbers,
  });

  return (
    <ScoreEntryForm
      slug={slug}
      code={code}
      eventName={event.name}
      format={event.format}
      holes={event.holes}
      holeNumbers={holeNumbers}
      parByHole={parByHole}
      yardageByHole={yardageByHole}
      groups={visibleGroups}
      initialScores={initialScores}
      readOnly={readOnly}
      allowGroupSwitch={allowGroupSwitch}
      lockedGroupId={access.type === "group" ? access.groupId : undefined}
      golfCourseId={caddieContext?.courseId ?? null}
      greenTargetsByHole={caddieContext?.greenTargetsByHole}
      holeFeaturesGeoJson={caddieContext?.holeFeaturesByHole}
      hasHeatmapByHole={caddieContext?.hasHeatmapByHole}
      selectedTeeKey={event.selectedTeeKey}
      selectedTeeColor={caddieContext?.selectedTeeColor ?? null}
    />
  );
}
