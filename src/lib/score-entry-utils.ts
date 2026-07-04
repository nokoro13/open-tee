import { formatScoreToPar } from "@/lib/scorecard";
import {
  computeSinglesMatch,
  formatNamedMatchStatus,
} from "@/lib/format-scoring";

export type RunningScore = {
  id: string;
  label: string;
  total: number | null;
  thru: number;
  toPar: number | null;
  toParDisplay: string | null;
};

export type MatchRunningScore = {
  playerA: { id: string; label: string };
  playerB: { id: string; label: string };
  status: string;
  thru: number;
  playerATotal: number | null;
  playerBTotal: number | null;
};

export type HoleScoreStatus = {
  hole: number;
  par?: number;
  saved: boolean;
  strokes?: number;
};

export function computeRunningScore(
  entityId: string,
  label: string,
  scores: Record<string, Record<number, number>>,
  holeNumbers: number[],
  parByHole: Record<number, number>
): RunningScore {
  let total = 0;
  let thru = 0;
  let parThru = 0;

  for (const hole of holeNumbers) {
    const strokes = scores[entityId]?.[hole];
    if (strokes == null) continue;
    total += strokes;
    thru += 1;
    const par = parByHole[hole];
    if (par != null) parThru += par;
  }

  const toPar = parThru > 0 ? total - parThru : null;

  return {
    id: entityId,
    label,
    total: thru > 0 ? total : null,
    thru,
    toPar,
    toParDisplay: toPar != null ? formatScoreToPar(toPar) : null,
  };
}

export function computeRunningScores(
  entries: { id: string; label: string }[],
  scores: Record<string, Record<number, number>>,
  holeNumbers: number[],
  parByHole: Record<number, number>
): RunningScore[] {
  return entries.map((entry) =>
    computeRunningScore(entry.id, entry.label, scores, holeNumbers, parByHole)
  );
}

export function computeMatchRunningScore(
  playerA: { id: string; label: string },
  playerB: { id: string; label: string },
  scores: Record<string, Record<number, number>>,
  holeNumbers: number[],
  holeCount: number,
  parByHole: Record<number, number> = {}
): MatchRunningScore {
  const scoresA = new Map<number, number>();
  const scoresB = new Map<number, number>();

  for (const hole of holeNumbers) {
    const a = scores[playerA.id]?.[hole];
    const b = scores[playerB.id]?.[hole];
    if (a != null) scoresA.set(hole, a);
    if (b != null) scoresB.set(hole, b);
  }

  const result = computeSinglesMatch(scoresA, scoresB, holeNumbers);
  const runningA = computeRunningScore(
    playerA.id,
    playerA.label,
    scores,
    holeNumbers,
    parByHole
  );
  const runningB = computeRunningScore(
    playerB.id,
    playerB.label,
    scores,
    holeNumbers,
    parByHole
  );

  return {
    playerA,
    playerB,
    status: formatNamedMatchStatus(
      playerA.label,
      playerB.label,
      result.holesUp,
      result.holesPlayed,
      holeCount,
      result.isComplete
    ),
    thru: result.holesPlayed,
    playerATotal: runningA.total,
    playerBTotal: runningB.total,
  };
}

export function findStartingHoleIndex(
  holeNumbers: number[],
  entryIds: string[],
  scores: Record<string, Record<number, number>>
): number {
  for (let i = 0; i < holeNumbers.length; i++) {
    const hole = holeNumbers[i]!;
    const complete = entryIds.every((id) => scores[id]?.[hole] != null);
    if (!complete) return i;
  }
  return Math.max(0, holeNumbers.length - 1);
}

export function countCompletedHoles(
  holeNumbers: number[],
  entryIds: string[],
  scores: Record<string, Record<number, number>>
): number {
  return holeNumbers.filter((hole) =>
    entryIds.every((id) => scores[id]?.[hole] != null)
  ).length;
}

export function isRoundComplete(
  holeNumbers: number[],
  entryIds: string[],
  scores: Record<string, Record<number, number>>
): boolean {
  return countCompletedHoles(holeNumbers, entryIds, scores) === holeNumbers.length;
}

export function getHoleStatuses(
  holeNumbers: number[],
  entryIds: string[],
  scores: Record<string, Record<number, number>>,
  parByHole: Record<number, number>,
  primaryEntityId: string
): HoleScoreStatus[] {
  return holeNumbers.map((hole) => {
    const strokes = scores[primaryEntityId]?.[hole];
    const saved = entryIds.every((id) => scores[id]?.[hole] != null);
    return {
      hole,
      par: parByHole[hole],
      saved,
      strokes,
    };
  });
}
