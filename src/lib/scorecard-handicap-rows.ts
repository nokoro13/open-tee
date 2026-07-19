export type ScorecardHandicapRowKey = "mens" | "ladies";

export type ScorecardHandicapRowInput = {
  rowKey: ScorecardHandicapRowKey;
  rowName: string;
  sortOrder: number;
};

export const PRESET_SCORECARD_HANDICAP_ROWS: ScorecardHandicapRowInput[] = [
  { rowKey: "mens", rowName: "Men's HDCP", sortOrder: 0 },
  { rowKey: "ladies", rowName: "Ladies' HDCP", sortOrder: 1 },
];

export const DEFAULT_SCORECARD_HANDICAP_ROWS: ScorecardHandicapRowInput[] = [
  ...PRESET_SCORECARD_HANDICAP_ROWS,
];

export function sortScorecardHandicapRows<
  T extends Pick<ScorecardHandicapRowInput, "sortOrder" | "rowName">,
>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.rowName.localeCompare(right.rowName);
  });
}

export function ocrRowLabelForHandicapRow(row: ScorecardHandicapRowInput): string {
  return row.rowKey === "mens" ? "MEN'S HDCP" : "LADIES' HDCP";
}

export type HandicapView = ScorecardHandicapRowKey;

export type HandicapHoleSnapshot = {
  strokeIndex?: number | null;
  ladiesStrokeIndex?: number | null;
};

export function resolveHandicapAvailability(holes: HandicapHoleSnapshot[]) {
  const hasMens = holes.some((hole) => hole.strokeIndex != null);
  const hasLadies = holes.some((hole) => hole.ladiesStrokeIndex != null);

  return {
    hasMens,
    hasLadies,
    hasBoth: hasMens && hasLadies,
  };
}

export function strokeIndexForHandicapView(
  hole: HandicapHoleSnapshot,
  view: HandicapView
): number | null {
  if (view === "ladies") {
    return hole.ladiesStrokeIndex ?? null;
  }

  return hole.strokeIndex ?? null;
}

export function defaultHandicapView(
  availability: ReturnType<typeof resolveHandicapAvailability>
): HandicapView {
  return availability.hasLadies && !availability.hasMens ? "ladies" : "mens";
}

export function activeHandicapView(
  view: HandicapView,
  availability: ReturnType<typeof resolveHandicapAvailability>
): HandicapView {
  if (view === "ladies" && availability.hasLadies) {
    return "ladies";
  }

  return availability.hasMens ? "mens" : "ladies";
}

export function handicapRowLabel(
  availability: ReturnType<typeof resolveHandicapAvailability>
): string | null {
  if (availability.hasBoth) return null;
  if (availability.hasLadies) return "Ladies HCP";
  return "HCP";
}

export function buildHandicapRowsFromHoles(
  holes: { strokeIndex?: number | null; ladiesStrokeIndex?: number | null }[]
): ScorecardHandicapRowInput[] {
  const hasMens = holes.some((hole) => hole.strokeIndex != null);
  const hasLadies = holes.some((hole) => hole.ladiesStrokeIndex != null);

  const rows = PRESET_SCORECARD_HANDICAP_ROWS.filter((row) => {
    if (row.rowKey === "mens") return hasMens || !hasLadies;
    if (row.rowKey === "ladies") return hasLadies;
    return false;
  });

  if (rows.length === 0) {
    return DEFAULT_SCORECARD_HANDICAP_ROWS.map((row, index) => ({
      ...row,
      sortOrder: index,
    }));
  }

  return rows.map((row, index) => ({ ...row, sortOrder: index }));
}
