"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, ChevronDown, Flag, RefreshCw } from "lucide-react";

import { LeaderboardExpandedScorecard } from "@/components/public/leaderboard-expanded-scorecard";
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
import { cn } from "@/lib/utils";
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
  embed?: boolean;
};

function MatchEntryNames({ entry }: { entry: LeaderboardEntry }) {
  const match = entry.matchPlayers;

  if (!match) {
    return <p className="font-medium text-slate-900">{entry.name}</p>;
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
    <p className="font-medium text-slate-900">
      <span>{match.playerAName}</span>
      <span className="text-muted-foreground"> vs </span>
      <span>{match.playerBName}</span>
    </p>
  );
}

function formatRank(
  entry: LeaderboardEntry,
  tiedRanks: Map<number, number>
): string {
  if (entry.total === null) return "—";
  if ((tiedRanks.get(entry.rank) ?? 0) > 1) return `T${entry.rank}`;
  return String(entry.rank);
}

export function LeaderboardView({
  slug,
  initialData,
  pollIntervalMs = 8000,
  embed = false,
}: LeaderboardViewProps) {
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [scoreHref, setScoreHref] = useState(() => getScorePageHref(slug));

  useEffect(() => {
    const storedCode = getScoringCode(slug);
    setScoreHref(getScorePageHref(slug, storedCode));
  }, [slug]);

  useEffect(() => {
    if (initialData.event.scoringStatus === "disabled") return;
    if (pollIntervalMs <= 0) return;

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
  const showToParColumn = formatShowsToPar(event.format);
  const isMatchPlay = isMatchPlayFormat(event.format);
  const scoringAvailable = event.scoringStatus !== "disabled";
  const scorecardLabel =
    event.scoringStatus === "open" ? "Enter scores" : "View scorecard";
  const scoreColumnLabel = showToParColumn ? "+/-" : totalLabel;
  const columnCount = 5;

  const tiedRanks = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of entries) {
      if (entry.total == null || entry.rank === 0) continue;
      counts.set(entry.rank, (counts.get(entry.rank) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const expandableCount = entries.filter(
    (entry) =>
      entry.thru > 0 || entry.total != null || Boolean(entry.scorecard)
  ).length;

  return (
    <div className="min-h-full bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-2 px-4 sm:h-16">
          {embed ? (
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Flag className="size-4" />
              </div>
              <span className="font-heading text-base font-semibold">OpenRound</span>
            </div>
          ) : (
            <Link href="/" className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Flag className="size-4" />
              </div>
              <span className="font-heading text-base font-semibold">OpenRound</span>
            </Link>
          )}
          <div className="flex items-center gap-2">
            {scoringAvailable && !embed && (
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

      {scoringAvailable && !embed && (
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

        <Card className="mt-6 overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border/60 bg-muted/20 pb-4">
            <div>
              <CardTitle>
                {ryderCup || isMatchPlay ? "Matches" : "Leaderboard"}
              </CardTitle>
              <CardDescription>
                {event.scoringStatus === "disabled"
                  ? "Scoring has not started yet."
                  : isFinal
                    ? "Final results"
                    : expandableCount > 0
                      ? "Tap a row to view the scorecard"
                      : "Updates automatically every few seconds"}
              </CardDescription>
            </div>
            {isLive && (
              <RefreshCw
                className={cn(
                  "size-4 shrink-0 text-muted-foreground",
                  isRefreshing && "animate-spin"
                )}
              />
            )}
          </CardHeader>
          <CardContent className="p-0">
            {entries.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                {event.scoringStatus === "disabled"
                  ? "Check back once the organizer opens scoring."
                  : "No scores yet."}
              </p>
            ) : (
              <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="w-[10%] px-2 py-2.5 font-semibold">Pos.</th>
                      <th className="px-1 py-2.5 font-semibold">{entityLabel}</th>
                      <th className="w-[14%] px-1 py-2.5 text-right font-semibold">
                        {scoreColumnLabel}
                      </th>
                      <th className="w-[12%] px-1 py-2.5 text-center font-semibold">
                        Thru
                      </th>
                      <th className="w-8 px-1 py-2.5" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const isExpanded = expandedEntryId === entry.id;
                      const canExpand =
                        entry.thru > 0 ||
                        entry.total != null ||
                        Boolean(entry.scorecard);

                      const toggleExpanded = () => {
                        if (!canExpand) return;
                        setExpandedEntryId(isExpanded ? null : entry.id);
                      };

                      const scoreDisplay = showToParColumn
                        ? (entry.toParDisplay ?? "—")
                        : (entry.totalDisplay ?? entry.total ?? "—");

                      return (
                        <Fragment key={entry.id}>
                          <tr
                            className={cn(
                              "group border-b border-slate-200/80 transition-colors",
                              isExpanded && "border-l-2 border-l-emerald-600 bg-emerald-50/40",
                              !isExpanded && canExpand && "hover:bg-slate-50/80",
                              canExpand && "cursor-pointer active:bg-slate-100/80"
                            )}
                            onClick={toggleExpanded}
                            onKeyDown={(keyboardEvent) => {
                              if (!canExpand) return;
                              if (
                                keyboardEvent.key === "Enter" ||
                                keyboardEvent.key === " "
                              ) {
                                keyboardEvent.preventDefault();
                                toggleExpanded();
                              }
                            }}
                            tabIndex={canExpand ? 0 : undefined}
                            role={canExpand ? "button" : undefined}
                            aria-expanded={canExpand ? isExpanded : undefined}
                            aria-label={
                              canExpand
                                ? `${isExpanded ? "Collapse" : "Expand"} scorecard for ${entry.name}`
                                : undefined
                            }
                          >
                            <td className="px-2 py-3.5 tabular-nums text-slate-500">
                              {formatRank(entry, tiedRanks)}
                            </td>
                            <td className="truncate px-1 py-3.5">
                              <MatchEntryNames entry={entry} />
                              {entry.subtitle && !isExpanded && (
                                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                                  {entry.subtitle}
                                </p>
                              )}
                            </td>
                            <td
                              className={cn(
                                "px-1 py-3.5 text-right text-base font-semibold tabular-nums",
                                entry.toPar != null && entry.toPar < 0
                                  ? "text-red-600"
                                  : entry.toPar != null && entry.toPar > 0
                                    ? "text-slate-600"
                                    : "text-slate-900"
                              )}
                            >
                              {scoreDisplay}
                            </td>
                            <td className="px-1 py-3.5 text-center tabular-nums text-slate-700">
                              {entry.thru || "—"}
                            </td>
                            <td className="px-1 py-3.5 text-right">
                              {canExpand ? (
                                <ChevronDown
                                  className={cn(
                                    "ml-auto size-4 text-slate-400 transition-transform duration-200 group-hover:text-slate-600",
                                    isExpanded && "rotate-180 text-emerald-700"
                                  )}
                                  aria-hidden
                                />
                              ) : null}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200/80 bg-slate-50/30">
                            <td colSpan={columnCount} className="p-0">
                              <div
                                className={cn(
                                  "grid transition-[grid-template-rows] duration-300 ease-out",
                                  isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                )}
                              >
                                <div className="overflow-hidden">
                                  <div className="border-t border-slate-200/80 px-2 py-3 sm:px-3">
                                    {entry.scorecard ? (
                                      <LeaderboardExpandedScorecard
                                        key={`${entry.id}-${entry.thru}`}
                                        scorecard={entry.scorecard}
                                        thru={entry.thru}
                                      />
                                    ) : (
                                      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                                        Scorecard details are not available for
                                        this entry yet.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
            )}
          </CardContent>
        </Card>

        {scoringAvailable && (
          <div className="mt-6 flex justify-center">
            <ButtonLink
              href={scoreHref}
              variant="default"
              className="h-10 w-full sm:w-auto"
            >
              <ClipboardList className="size-4" />
              {scorecardLabel}
            </ButtonLink>
          </div>
        )}
      </main>
    </div>
  );
}
