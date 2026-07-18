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
