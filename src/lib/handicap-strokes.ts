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

  const match = /^(\d+(?:\.\d+)?)$/.exec(normalized);
  if (!match) return null;

  return Math.round(Number.parseFloat(match[0]));
}

export type HandicapValidationResult =
  | { valid: true; value: string | null }
  | { valid: false; error: string };

/** Validate and normalize handicap input for storage. */
export function validateHandicapInput(
  handicap: string | null | undefined
): HandicapValidationResult {
  const trimmed = handicap?.trim() ?? "";

  if (!trimmed) {
    return { valid: true, value: null };
  }

  if (/^-/.test(trimmed)) {
    return {
      valid: false,
      error:
        "Plus handicaps use a + sign (e.g. +3), not a minus sign. Regular handicaps are entered as plain numbers (e.g. 12).",
    };
  }

  const plusMatch = /^\+(\d+(?:\.\d+)?)$/.exec(trimmed);
  if (plusMatch) {
    return { valid: true, value: `+${plusMatch[1]}` };
  }

  const regularMatch = /^(\d+(?:\.\d+)?)$/.exec(trimmed);
  if (regularMatch) {
    return { valid: true, value: regularMatch[1] };
  }

  return {
    valid: false,
    error: "Enter a number (e.g. 12.4) or a plus handicap (e.g. +3).",
  };
}

/** Standard golf notation for scorecards (+3 for plus handicaps). */
export function formatHandicapDisplay(
  handicap: string | null | undefined
): string {
  if (!handicap?.trim()) return "";

  const parsed = parseCourseHandicap(handicap);
  if (parsed == null) return handicap.trim();
  if (parsed < 0) return `+${Math.abs(parsed)}`;
  if (parsed === 0) return "0";

  return handicap.trim();
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
