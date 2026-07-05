/** Parse a registration handicap string into a whole-number course handicap. */
export function parseCourseHandicap(
  handicap: string | null | undefined
): number | null {
  if (!handicap?.trim()) return null;

  const normalized = handicap.trim();
  const plusMatch = /^\+(\d+(?:\.\d+)?)$/.exec(normalized);
  if (plusMatch) {
    return -Math.round(Number.parseFloat(plusMatch[1]));
  }

  const match = /(\d+(?:\.\d+)?)/.exec(normalized);
  if (!match) return null;

  return Math.round(Number.parseFloat(match[0]));
}

/**
 * Strokes received on a hole for stroke-play net scoring.
 * Stroke index 1 is the hardest hole (receives the first extra stroke).
 */
export function strokesReceivedOnHole(
  courseHandicap: number,
  strokeIndex: number,
  holeCount: number
): number {
  if (courseHandicap <= 0 || strokeIndex < 1) return 0;

  const base = Math.floor(courseHandicap / holeCount);
  const remainder = courseHandicap % holeCount;
  return base + (strokeIndex <= remainder ? 1 : 0);
}
