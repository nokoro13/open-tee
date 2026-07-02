type ScoredHoleRow = {
  holeNumber: number;
  strokes: number;
  teamSide?: string | null;
  updatedAt?: Date | string | null;
};

/** Prefer canonical team rows over legacy duplicates (e.g. null teamSide). */
function scoreRowPriority(row: ScoredHoleRow): number {
  if (row.teamSide === "team") return 3;
  if (row.teamSide === "a" || row.teamSide === "b") return 2;
  if (row.teamSide == null) return 1;
  return 0;
}

function isNewer(
  candidate: ScoredHoleRow,
  existing: ScoredHoleRow
): boolean {
  const candidateTime = candidate.updatedAt
    ? new Date(candidate.updatedAt).getTime()
    : 0;
  const existingTime = existing.updatedAt
    ? new Date(existing.updatedAt).getTime()
    : 0;
  return candidateTime >= existingTime;
}

function shouldReplaceScoreRow(
  candidate: ScoredHoleRow,
  existing: ScoredHoleRow
): boolean {
  const candidatePriority = scoreRowPriority(candidate);
  const existingPriority = scoreRowPriority(existing);
  if (candidatePriority !== existingPriority) {
    return candidatePriority > existingPriority;
  }
  return isNewer(candidate, existing);
}

export function dedupeScoresByHole<T extends ScoredHoleRow>(rows: T[]): T[] {
  const byHole = new Map<number, T>();

  for (const row of rows) {
    const existing = byHole.get(row.holeNumber);
    if (!existing || shouldReplaceScoreRow(row, existing)) {
      byHole.set(row.holeNumber, row);
    }
  }

  return [...byHole.values()].sort((a, b) => a.holeNumber - b.holeNumber);
}

export function sumDedupedStrokes<T extends ScoredHoleRow>(
  rows: T[]
): { total: number | null; thru: number; scoredHoles: number[] } {
  const unique = dedupeScoresByHole(rows);

  if (unique.length === 0) {
    return { total: null, thru: 0, scoredHoles: [] };
  }

  return {
    total: unique.reduce((sum, row) => sum + row.strokes, 0),
    thru: unique.length,
    scoredHoles: unique.map((row) => row.holeNumber),
  };
}
