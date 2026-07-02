import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getHoleNumbers,
  getScoreEntryGroups,
  getScoresForEvent,
  getPublishedEventForScoring,
  isScoringEditable,
  scoresToMap,
  validateScoringCode,
} from "@/lib/scoring";
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

  if (!validateScoringCode(event, code)) {
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

  const [groups, scores] = await Promise.all([
    getScoreEntryGroups(event.id, event.format),
    getScoresForEvent(event.id),
  ]);

  const scoreMap = scoresToMap(
    scores,
    event.format,
    groups.map((g) => ({ id: g.id, matchType: g.matchType ?? null }))
  );
  const initialScores: Record<string, Record<number, number>> = {};
  for (const [key, holes] of scoreMap.entries()) {
    initialScores[key] = Object.fromEntries(holes.entries());
  }

  const readOnly = !isScoringEditable(event.scoringStatus);

  const parByHole = Object.fromEntries(
    (event.eventHoles ?? []).map((hole) => [hole.holeNumber, hole.par])
  );

  return (
    <ScoreEntryForm
      slug={slug}
      code={code}
      eventName={event.name}
      format={event.format}
      holes={event.holes}
      holeNumbers={getHoleNumbers(event.holes)}
      parByHole={parByHole}
      groups={groups}
      initialScores={initialScores}
      readOnly={readOnly}
    />
  );
}
