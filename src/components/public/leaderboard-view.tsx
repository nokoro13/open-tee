"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Flag, RefreshCw } from "lucide-react";

import type { LeaderboardEntry, RyderCupSummary } from "@/lib/scoring";
import { formatRyderCupScore } from "@/lib/scoring";
import {
  formatShowsToPar,
  getEntityColumnLabel,
  getEventFormatLabel,
  getTotalColumnLabel,
  isMatchPlayFormat,
} from "@/lib/event-formats";
import {
  getScorePageHref,
  getScoringCode,
} from "@/lib/scoring-code-storage";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LeaderboardPayload = {
  event: {
    name: string;
    slug: string;
    format: string;
    holes: string;
    scoringStatus: string;
    courseName?: string;
  };
  entries: LeaderboardEntry[];
  ryderCup?: RyderCupSummary;
  updatedAt?: string;
};

type LeaderboardViewProps = {
  slug: string;
  initialData: LeaderboardPayload;
  pollIntervalMs?: number;
};

function MatchEntryNames({
  entry,
}: {
  entry: LeaderboardEntry;
}) {
  const match = entry.matchPlayers;

  if (!match) {
    return <p className="font-medium">{entry.name}</p>;
  }

  if (match.leader === "a") {
    return (
      <p className="font-medium">
        <span className="font-semibold text-primary">{match.playerAName}</span>
        <span className="text-muted-foreground"> vs </span>
        <span className="font-semibold text-destructive">{match.playerBName}</span>
      </p>
    );
  }

  if (match.leader === "b") {
    return (
      <p className="font-medium">
        <span className="font-semibold text-primary">{match.playerBName}</span>
        <span className="text-muted-foreground"> vs </span>
        <span className="font-semibold text-destructive">{match.playerAName}</span>
      </p>
    );
  }

  return (
    <p className="font-medium">
      <span>{match.playerAName}</span>
      <span className="text-muted-foreground"> vs </span>
      <span>{match.playerBName}</span>
    </p>
  );
}

export function LeaderboardView({
  slug,
  initialData,
  pollIntervalMs = 8000,
}: LeaderboardViewProps) {
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scoreHref, setScoreHref] = useState(() => getScorePageHref(slug));

  useEffect(() => {
    const storedCode = getScoringCode(slug);
    setScoreHref(getScorePageHref(slug, storedCode));
  }, [slug]);

  useEffect(() => {
    if (initialData.event.scoringStatus === "disabled") return;

    async function refresh() {
      try {
        const response = await fetch(`/api/e/${slug}/leaderboard`, {
          cache: "no-store",
        });
        if (response.ok) {
          const json = (await response.json()) as LeaderboardPayload;
          setData(json);
        }
      } finally {
        setIsRefreshing(false);
      }
    }

    const interval = setInterval(() => {
      setIsRefreshing(true);
      void refresh();
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [slug, pollIntervalMs, initialData.event.scoringStatus]);

  const { event, entries, ryderCup } = data;
  const isLive = event.scoringStatus === "open";
  const isFinal = event.scoringStatus === "finalized";
  const totalLabel = getTotalColumnLabel(event.format);
  const entityLabel = getEntityColumnLabel(event.format);
  const showToPar = formatShowsToPar(event.format);
  const isMatchPlay = isMatchPlayFormat(event.format);
  const scoringAvailable = event.scoringStatus !== "disabled";
  const scorecardLabel =
    event.scoringStatus === "open" ? "Enter scores" : "View scorecard";

  return (
    <div className="min-h-full bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-2 px-4 sm:h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Flag className="size-4" />
            </div>
            <span className="font-heading text-base font-semibold">OpenRound</span>
          </Link>
          <div className="flex items-center gap-2">
            {scoringAvailable && (
              <ButtonLink
                href={scoreHref}
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
              >
                <ClipboardList className="size-4" />
                {scorecardLabel}
              </ButtonLink>
            )}
            {isLive && (
              <Badge variant="default" className="gap-1">
                <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" />
                Live
              </Badge>
            )}
            {isFinal && <Badge variant="secondary">Final</Badge>}
          </div>
        </div>
      </header>

      {scoringAvailable && (
        <div className="border-b border-border bg-muted/30 px-4 py-3 sm:hidden">
          <ButtonLink href={scoreHref} className="h-10 w-full">
            <ClipboardList className="size-4" />
            {scorecardLabel}
          </ButtonLink>
        </div>
      )}

      <main className="mx-auto max-w-lg px-4 py-6 pb-12">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
          {event.courseName && (
            <p className="text-sm text-muted-foreground">{event.courseName}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{getEventFormatLabel(event.format)}</Badge>
            <Badge variant="outline">{event.holes} holes</Badge>
          </div>
        </div>

        {ryderCup && (
          <Card className="mt-6 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-lg">Team score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-3xl font-semibold tracking-tight tabular-nums">
                {ryderCup.teamAName}{" "}
                <span className="text-primary">
                  {formatRyderCupScore(ryderCup.teamAPoints, ryderCup.teamBPoints)}
                </span>{" "}
                {ryderCup.teamBName}
              </p>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Match points from completed matches
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>
                {ryderCup || isMatchPlay ? "Matches" : "Leaderboard"}
              </CardTitle>
              <CardDescription>
                {event.scoringStatus === "disabled"
                  ? "Scoring has not started yet."
                  : isFinal
                    ? "Final results"
                    : "Updates automatically every few seconds"}
              </CardDescription>
            </div>
            {isLive && (
              <RefreshCw
                className={`size-4 shrink-0 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`}
              />
            )}
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {event.scoringStatus === "disabled"
                  ? "Check back once the organizer opens scoring."
                  : "No scores yet."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 pr-2 font-medium">#</th>
                      <th className="pb-2 pr-2 font-medium">{entityLabel}</th>
                      <th className="pb-2 pr-2 text-center font-medium">Thru</th>
                      <th className="pb-2 pr-2 text-right font-medium">
                        {totalLabel}
                      </th>
                      {showToPar && entries.some((e) => e.toParDisplay) && (
                        <th className="pb-2 text-right font-medium">+/-</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="py-3 pr-2 tabular-nums text-muted-foreground">
                          {entry.total === null ? "—" : entry.rank}
                        </td>
                        <td className="py-3 pr-2">
                          <MatchEntryNames entry={entry} />
                          {entry.subtitle && (
                            <p className="text-xs text-muted-foreground">
                              {entry.subtitle}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-2 text-center tabular-nums">
                          {entry.thru || "—"}
                        </td>
                        <td className="py-3 pr-2 text-right font-semibold tabular-nums">
                          {entry.totalDisplay ?? entry.total ?? "—"}
                        </td>
                        {showToPar && entries.some((e) => e.toParDisplay) && (
                          <td
                            className={`py-3 text-right font-semibold tabular-nums ${
                              entry.toPar !== null && entry.toPar < 0
                                ? "text-primary"
                                : entry.toPar !== null && entry.toPar > 0
                                  ? "text-muted-foreground"
                                  : ""
                            }`}
                          >
                            {entry.toParDisplay ?? "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {scoringAvailable && (
          <div className="mt-6 flex justify-center">
            <ButtonLink href={scoreHref} variant="default" className="h-10 w-full sm:w-auto">
              <ClipboardList className="size-4" />
              {scorecardLabel}
            </ButtonLink>
          </div>
        )}
      </main>
    </div>
  );
}
