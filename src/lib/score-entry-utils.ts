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

export function isHoleCompleteForEntries(
  hole: number,
  entryIds: string[],
  scores: Record<string, Record<number, number>>
): boolean {
  return entryIds.every((id) => scores[id]?.[hole] != null);
}

/** First hole that still needs scores confirmed, in course order. */
export function findFirstUnconfirmedHoleIndex(
  holeNumbers: number[],
  confirmedHoles: ReadonlySet<number>
): number {
  for (let i = 0; i < holeNumbers.length; i++) {
    if (!confirmedHoles.has(holeNumbers[i]!)) return i;
  }
  return Math.max(0, holeNumbers.length - 1);
}

/** Whether the scorer may enter or edit scores on this hole. */
export function canEnterScoresForHole(
  holeNumber: number,
  holeNumbers: number[],
  confirmedHoles: ReadonlySet<number>
): boolean {
  const targetIndex = holeNumbers.indexOf(holeNumber);
  if (targetIndex === -1) return false;

  const requiredIndex = findFirstUnconfirmedHoleIndex(
    holeNumbers,
    confirmedHoles
  );
  return targetIndex <= requiredIndex;
}

export function validatePriorHolesComplete(
  holeNumber: number,
  holeNumbers: number[],
  entryIds: string[],
  scores: Record<string, Record<number, number>>
): string | null {
  const targetIndex = holeNumbers.indexOf(holeNumber);
  if (targetIndex <= 0) return null;

  for (let i = 0; i < targetIndex; i++) {
    const hole = holeNumbers[i]!;
    if (!isHoleCompleteForEntries(hole, entryIds, scores)) {
      return `Enter scores for hole ${hole} before hole ${holeNumber}.`;
    }
  }

  return null;
}

export function findStartingHoleIndex(
  holeNumbers: number[],
  entryIds: string[],
  scores: Record<string, Record<number, number>>
): number {
  for (let i = 0; i < holeNumbers.length; i++) {
    const hole = holeNumbers[i]!;
    const complete = isHoleCompleteForEntries(hole, entryIds, scores);
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
    isHoleCompleteForEntries(hole, entryIds, scores)
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
      isHoleCompleteForEntries(hole, entryIds, scores)
    )
  );
}

/** Merge server scores into local state when another scorer saves for the group. */
export function applyRemoteScores(
  local: Record<string, Record<number, number>>,
  remote: Record<string, Record<number, number>>,
  holeNumbers: number[],
  entryIds: string[],
  options: { skipHole?: number } = {}
): Record<string, Record<number, number>> {
  const merged: Record<string, Record<number, number>> = { ...local };

  for (const entityId of entryIds) {
    const entityScores = { ...(merged[entityId] ?? {}) };

    for (const hole of holeNumbers) {
      if (options.skipHole === hole) continue;
      if (!isHoleCompleteForEntries(hole, entryIds, remote)) continue;

      const remoteValue = remote[entityId]?.[hole];
      if (remoteValue != null) {
        entityScores[hole] = remoteValue;
      }
    }

    merged[entityId] = entityScores;
  }

  for (const [entityId, holes] of Object.entries(remote)) {
    if (entryIds.includes(entityId)) continue;
    merged[entityId] = { ...(merged[entityId] ?? {}), ...holes };
  }

  return merged;
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
    const saved = isHoleCompleteForEntries(hole, entryIds, scores);
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
