"use client";

import { Check, X } from "lucide-react";

import type {
  ScorecardParValidation,
  ScorecardStrokeIndexValidation,
  ScorecardYardageValidation,
} from "@/lib/scorecard-ocr";
import { cn } from "@/lib/utils";

function TotalCheckCell({
  holeSum,
  expected,
  matches,
}: {
  holeSum: number | null;
  expected: number | null;
  matches: boolean;
}) {
  if (holeSum == null && expected == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const hasComparison = holeSum != null && expected != null;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 leading-none",
        hasComparison && matches && "text-emerald-700 dark:text-emerald-300",
        hasComparison && !matches && "text-amber-800 dark:text-amber-200"
      )}
    >
      <span className="text-xs font-medium tabular-nums">
        {holeSum?.toLocaleString() ?? "—"}
      </span>
      {hasComparison && !matches && expected != null && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          exp {expected.toLocaleString()}
        </span>
      )}
      {hasComparison &&
        (matches ? (
          <Check className="size-3" aria-label="Matches" />
        ) : (
          <X className="size-3" aria-label="Mismatch" />
        ))}
    </div>
  );
}

type ScorecardOcrTotalsPanelProps = {
  parValidation: ScorecardParValidation | null;
  yardageValidation: ScorecardYardageValidation[];
  handicapValidation: ScorecardStrokeIndexValidation[];
};

export function ScorecardOcrTotalsPanel({
  parValidation,
  yardageValidation,
  handicapValidation,
}: ScorecardOcrTotalsPanelProps) {
  if (
    !parValidation &&
    yardageValidation.length === 0 &&
    handicapValidation.length === 0
  ) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-muted/20 px-4 py-3">
      <p className="text-sm font-medium">OCR totals check</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Compare printed scorecard totals against the values extracted from your
        photo.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-lg border-collapse text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="w-28 py-2 pr-4 text-left font-medium">Row</th>
              <th className="w-24 px-3 py-2 text-center font-medium">OUT</th>
              <th className="w-24 px-3 py-2 text-center font-medium">IN</th>
              <th className="w-24 px-3 py-2 text-center font-medium">TOT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {parValidation && (
              <tr>
                <td className="py-2.5 pr-4 font-medium">Par</td>
                <td className="px-3 py-2.5 text-center">
                  <TotalCheckCell
                    holeSum={parValidation.frontSum}
                    expected={parValidation.frontExpected}
                    matches={parValidation.frontMatches}
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <TotalCheckCell
                    holeSum={parValidation.backSum}
                    expected={parValidation.backExpected}
                    matches={parValidation.backMatches}
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <TotalCheckCell
                    holeSum={parValidation.totalSum}
                    expected={parValidation.totalExpected}
                    matches={parValidation.totalMatches}
                  />
                </td>
              </tr>
            )}
            {yardageValidation.map((entry) => (
              <tr key={entry.teeKey}>
                <td className="py-2.5 pr-4 font-medium">{entry.teeName}</td>
                <td className="px-3 py-2.5 text-center">
                  <TotalCheckCell
                    holeSum={entry.totals.frontSum}
                    expected={entry.totals.frontExpected}
                    matches={entry.totals.frontMatches}
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <TotalCheckCell
                    holeSum={entry.totals.backSum}
                    expected={entry.totals.backExpected}
                    matches={entry.totals.backMatches}
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <TotalCheckCell
                    holeSum={entry.totals.totalSum}
                    expected={entry.totals.totalExpected}
                    matches={entry.totals.totalMatches}
                  />
                </td>
              </tr>
            ))}
            {handicapValidation.map((entry) => (
              <tr key={entry.label}>
                <td className="py-2.5 pr-4 font-medium">{entry.label}</td>
                <td className="px-3 py-2.5 text-center" colSpan={3}>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 tabular-nums",
                      entry.isValidPermutation &&
                        "text-emerald-700 dark:text-emerald-300",
                      !entry.isValidPermutation &&
                        "text-amber-800 dark:text-amber-200"
                    )}
                  >
                    <span className="text-xs font-medium">
                      {entry.sum ?? "—"} / {entry.expectedSum}
                    </span>
                    {entry.sum != null &&
                      (entry.isValidPermutation ? (
                        <Check className="size-3" />
                      ) : (
                        <X className="size-3" />
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
