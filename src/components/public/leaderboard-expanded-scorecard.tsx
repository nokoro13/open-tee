"use client";

import { useMemo } from "react";

import { ScoreParMark } from "@/components/public/score-par-mark";
import type {
  LeaderboardScorecard,
  LeaderboardScorecardHole,
  LeaderboardScorecardPlayerRow,
  LeaderboardScorecardSummaryRow,
} from "@/lib/leaderboard-scorecard";
import { cn } from "@/lib/utils";

type LeaderboardExpandedScorecardProps = {
  scorecard: LeaderboardScorecard;
  thru: number;
};

const MARK_SIZE = "size-5 min-w-5 text-[9px] leading-none";

function scoreCellBackground(
  strokes: number | null,
  par: number | null
): string {
  if (strokes == null || par == null) return "bg-white";
  const diff = strokes - par;
  if (diff <= -2) return "bg-primary/15";
  if (diff === -1) return "bg-primary/10";
  if (diff === 0) return "bg-muted/30";
  if (diff === 1) return "bg-muted/50";
  return "bg-destructive/5";
}

function StrokeDots({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      className="absolute right-px top-px flex flex-col gap-px"
      aria-hidden
    >
      {Array.from({ length: Math.min(count, 3) }, (_, index) => (
        <span
          key={index}
          className="block size-[2px] rounded-full bg-slate-800/80"
        />
      ))}
    </span>
  );
}

function holeIndex(allHoles: LeaderboardScorecardHole[], holeNumber: number) {
  return allHoles.findIndex((hole) => hole.holeNumber === holeNumber);
}

function sectionTotal(
  allHoles: LeaderboardScorecardHole[],
  sectionHoles: LeaderboardScorecardHole[],
  scores: (number | null)[]
): number | null {
  let total = 0;
  let count = 0;

  for (const hole of sectionHoles) {
    const index = holeIndex(allHoles, hole.holeNumber);
    const value = scores[index];
    if (value == null) continue;
    total += value;
    count += 1;
  }

  return count > 0 ? total : null;
}

function playerLabel(name: string, handicapDisplay: string | null) {
  if (!handicapDisplay) return name;
  return `${name} (${handicapDisplay})`;
}

function ScoreValue({
  strokes,
  par,
  emphasized,
}: {
  strokes: number | null;
  par: number | null;
  emphasized?: boolean;
}) {
  if (strokes == null) {
    return <span className="text-slate-300">·</span>;
  }

  if (par == null) {
    return (
      <span className={cn("tabular-nums", emphasized && "font-semibold")}>
        {strokes}
      </span>
    );
  }

  return (
    <ScoreParMark
      strokes={strokes}
      par={par}
      compact
      className={cn(MARK_SIZE, emphasized && "font-semibold")}
    >
      {strokes}
    </ScoreParMark>
  );
}

function ScoreCell({
  strokes,
  par,
  strokeDots = 0,
  isCurrentHole,
  emphasized,
}: {
  strokes: number | null;
  par: number | null;
  strokeDots?: number;
  isCurrentHole?: boolean;
  emphasized?: boolean;
}) {
  return (
    <td
      className={cn(
        "relative h-7 border-b border-r border-slate-200/80 p-0 text-center",
        scoreCellBackground(strokes, par),
        isCurrentHole && "ring-1 ring-inset ring-primary/40"
      )}
    >
      <StrokeDots count={strokeDots} />
      <span className="inline-flex size-full items-center justify-center">
        <ScoreValue strokes={strokes} par={par} emphasized={emphasized} />
      </span>
    </td>
  );
}

function HoleHeaderCell({
  holeNumber,
  isCurrentHole,
}: {
  holeNumber: number;
  isCurrentHole: boolean;
}) {
  return (
    <th
      className={cn(
        "h-6 border-b border-r border-slate-200/80 p-0 text-center text-[10px] font-semibold leading-none tabular-nums",
        isCurrentHole
          ? "bg-primary text-primary-foreground"
          : "bg-slate-100/80 text-slate-600"
      )}
    >
      {holeNumber}
    </th>
  );
}

function ScorecardHalf({
  title,
  sectionHoles,
  allHoles,
  thru,
  playerRows,
  summaryRow,
}: {
  title: string;
  sectionHoles: LeaderboardScorecardHole[];
  allHoles: LeaderboardScorecardHole[];
  thru: number;
  playerRows: LeaderboardScorecardPlayerRow[];
  summaryRow?: LeaderboardScorecardSummaryRow;
}) {
  if (sectionHoles.length === 0) return null;

  const parTotal = sectionHoles.reduce((sum, hole) => sum + hole.par, 0);
  const holeCount = sectionHoles.length;

  return (
    <div className="w-full min-w-0">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[26%]" />
            {Array.from({ length: holeCount }, (_, index) => (
              <col key={index} />
            ))}
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="h-6 border-b border-r border-slate-200/80 bg-slate-100/90" />
              {sectionHoles.map((hole) => (
                <HoleHeaderCell
                  key={hole.holeNumber}
                  holeNumber={hole.holeNumber}
                  isCurrentHole={thru === hole.holeNumber}
                />
              ))}
              <th className="h-6 border-b border-slate-200/80 bg-slate-100/80 p-0 text-center text-[9px] font-semibold leading-none text-slate-600">
                Tot
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="h-7 truncate border-b border-r border-slate-200/80 bg-white px-1 text-left text-[10px] font-medium text-slate-600">
                Par
              </td>
              {sectionHoles.map((hole) => (
                <td
                  key={`par-${hole.holeNumber}`}
                  className="h-7 border-b border-r border-slate-200/80 bg-white p-0 text-center text-[10px] tabular-nums text-slate-600"
                >
                  {hole.par}
                </td>
              ))}
              <td className="h-7 border-b border-slate-200/80 bg-white p-0 text-center text-[10px] font-semibold tabular-nums text-slate-800">
                {parTotal}
              </td>
            </tr>

            {playerRows.map((player) => (
              <tr key={player.id}>
                <td
                  className="h-7 truncate border-b border-r border-slate-200/80 bg-white px-1 text-left text-[9px] font-medium text-slate-800"
                  title={playerLabel(player.name, player.handicapDisplay)}
                >
                  {playerLabel(player.name, player.handicapDisplay)}
                </td>
                {sectionHoles.map((hole) => {
                  const index = holeIndex(allHoles, hole.holeNumber);
                  return (
                    <ScoreCell
                      key={`${player.id}-${hole.holeNumber}`}
                      strokes={player.grossScores[index] ?? null}
                      par={hole.par}
                      strokeDots={player.strokesReceived[index] ?? 0}
                      isCurrentHole={thru === hole.holeNumber}
                    />
                  );
                })}
                <td className="h-7 border-b border-slate-200/80 bg-white p-0 text-center text-[10px] font-semibold tabular-nums text-slate-900">
                  {sectionTotal(allHoles, sectionHoles, player.grossScores) ??
                    "·"}
                </td>
              </tr>
            ))}

            {summaryRow && (
              <tr>
                <td className="h-7 truncate border-r border-slate-200/80 bg-slate-50 px-1 text-left text-[10px] font-semibold text-slate-800">
                  {summaryRow.label}
                </td>
                {sectionHoles.map((hole) => {
                  const index = holeIndex(allHoles, hole.holeNumber);
                  return (
                    <ScoreCell
                      key={`${summaryRow.label}-${hole.holeNumber}`}
                      strokes={summaryRow.scores[index] ?? null}
                      par={hole.par}
                      isCurrentHole={thru === hole.holeNumber}
                      emphasized
                    />
                  );
                })}
                <td className="h-7 bg-slate-50 p-0 text-center text-[10px] font-bold tabular-nums text-slate-900">
                  {sectionTotal(allHoles, sectionHoles, summaryRow.scores) ??
                    "·"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreLegend() {
  const items = [
    { label: "Birdie", strokes: 3, par: 4 },
    { label: "Eagle+", strokes: 3, par: 5 },
    { label: "Bogey", strokes: 5, par: 4 },
    { label: "Double+", strokes: 6, par: 4 },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200/80 pt-3">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600"
        >
          <ScoreParMark
            strokes={item.strokes}
            par={item.par}
            compact
            className="size-6 min-w-6 text-[10px] leading-none"
          >
            {item.strokes}
          </ScoreParMark>
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function LeaderboardExpandedScorecard({
  scorecard,
  thru,
}: LeaderboardExpandedScorecardProps) {
  const { holes, playerRows, summaryRow } = scorecard;

  const frontNine = useMemo(
    () => holes.filter((hole) => hole.holeNumber <= 9),
    [holes]
  );
  const backNine = useMemo(
    () => holes.filter((hole) => hole.holeNumber > 9),
    [holes]
  );

  if (holes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        No scorecard data available yet.
      </p>
    );
  }

  const displayHoles = frontNine.length > 0 ? frontNine : holes;

  return (
    <div className="w-full min-w-0 space-y-3">
      {thru > 0 && (
        <div className="flex justify-end">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary ring-1 ring-primary/15">
            Thru {thru}
          </span>
        </div>
      )}

      <ScorecardHalf
        title="Front nine"
        sectionHoles={displayHoles}
        allHoles={holes}
        thru={thru}
        playerRows={playerRows}
        summaryRow={summaryRow}
      />

      {backNine.length > 0 && (
        <ScorecardHalf
          title="Back nine"
          sectionHoles={backNine}
          allHoles={holes}
          thru={thru}
          playerRows={playerRows}
          summaryRow={summaryRow}
        />
      )}

      <ScoreLegend />
    </div>
  );
}
