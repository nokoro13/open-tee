import { formatScoreToPar } from "@/lib/scorecard";

export type RunningScore = {
  id: string;
  label: string;
  total: number | null;
  thru: number;
  toPar: number | null;
  toParDisplay: string | null;
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
