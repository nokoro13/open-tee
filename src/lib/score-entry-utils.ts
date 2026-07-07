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

export type HoleScoreEntry = {
  id: string;
  label: string;
  strokes?: number;
};

export type HoleScoreStatus = {
  hole: number;
  par?: number;
  yardage?: number;
  saved: boolean;
  /** Primary / single-player score (first entry). */
  strokes?: number;
  /** All players' scores for this hole when scoring as a group or match. */
  entries?: HoleScoreEntry[];
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

export function getConfirmedHoles(
  holeNumbers: number[],
  entryIds: string[],
  scores: Record<string, Record<number, number>>
): Set<number> {
  return new Set(
    holeNumbers.filter((hole) =>
      entryIds.every((id) => scores[id]?.[hole] != null)
    )
  );
}

export function getHoleStatuses(
  holeNumbers: number[],
  entryIds: string[],
  scores: Record<string, Record<number, number>>,
  parByHole: Record<number, number>,
  scoreEntries?: Array<{ id: string; label: string }>,
  yardageByHole: Record<number, number> = {}
): HoleScoreStatus[] {
  return holeNumbers.map((hole) => {
    const entries = scoreEntries?.map((entry) => ({
      id: entry.id,
      label: entry.label,
      strokes: scores[entry.id]?.[hole],
    }));
    const primaryId = entryIds[0] ?? "";
    const strokes = scores[primaryId]?.[hole];
    const saved = entryIds.every((id) => scores[id]?.[hole] != null);
    return {
      hole,
      par: parByHole[hole],
      yardage: yardageByHole[hole],
      saved,
      strokes,
      entries: entries && entries.length > 1 ? entries : undefined,
    };
  });
}
