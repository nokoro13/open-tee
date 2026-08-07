"use client";

import { useMemo, type ComponentProps } from "react";
import { Check, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { holeNumbersForCount } from "@/lib/course-onboarding";
import type { CourseTeeInput } from "@/lib/course-tees";
import { cn } from "@/lib/utils";

export type ScorecardEditRow = {
  holeNumber: number;
  par: number;
  strokeIndex: string;
  ladiesStrokeIndex: string;
  teeYardages: Record<string, string>;
};

type CourseScorecardEditTableProps = {
  holeCount: number;
  rows: ScorecardEditRow[];
  sortedTees: CourseTeeInput[];
  showMensHandicap: boolean;
  showLadiesHandicap: boolean;
  onRowsChange: (rows: ScorecardEditRow[]) => void;
};

const NUMERIC_INPUT =
  "h-7 w-full min-w-0 rounded-md border border-input/60 bg-background px-0.5 text-center text-xs tabular-nums shadow-none [appearance:textfield] focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function parseNumeric(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumPar(rows: ScorecardEditRow[], range: number[]): number {
  return range.reduce((total, holeNumber) => {
    const row = rows.find((entry) => entry.holeNumber === holeNumber);
    return total + (row?.par ?? 0);
  }, 0);
}

function sumYardages(
  rows: ScorecardEditRow[],
  teeKey: string,
  range: number[]
): number {
  return range.reduce((total, holeNumber) => {
    const row = rows.find((entry) => entry.holeNumber === holeNumber);
    const value = parseNumeric(row?.teeYardages[teeKey] ?? "");
    return total + (value ?? 0);
  }, 0);
}

function NumericCellInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return <Input className={cn(NUMERIC_INPUT, className)} {...props} />;
}

function ScorecardNineTable({
  title,
  totalLabel,
  holeNumbers,
  rows,
  allRows,
  sortedTees,
  showMensHandicap,
  showLadiesHandicap,
  onRowsChange,
}: {
  title: string;
  totalLabel: string;
  holeNumbers: number[];
  rows: ScorecardEditRow[];
  allRows: ScorecardEditRow[];
  sortedTees: CourseTeeInput[];
  showMensHandicap: boolean;
  showLadiesHandicap: boolean;
  onRowsChange: (rows: ScorecardEditRow[]) => void;
}) {
  function updateRow(holeNumber: number, patch: Partial<ScorecardEditRow>) {
    const next = allRows.map((row) =>
      row.holeNumber === holeNumber ? { ...row, ...patch } : row
    );
    onRowsChange(next);
  }

  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <caption className="border-b bg-muted/30 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </caption>
        <thead>
          <tr className="border-b bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="w-9 px-2 py-2 text-center font-medium">#</th>
            <th className="w-11 px-1 py-2 text-center font-medium">Par</th>
            {sortedTees.map((tee) => (
              <th
                key={tee.teeKey}
                className="w-13 px-1 py-2 text-center font-medium"
                title={tee.teeName}
              >
                <span className="inline-flex items-center justify-center gap-1 normal-case">
                  {tee.teeColor && (
                    <span
                      className="size-1.5 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: tee.teeColor }}
                      aria-hidden
                    />
                  )}
                  <span className="truncate">{tee.teeName}</span>
                </span>
              </th>
            ))}
            {showMensHandicap && (
              <th className="w-11 px-1 py-2 text-center font-medium">M</th>
            )}
            {showLadiesHandicap && (
              <th className="w-11 px-1 py-2 text-center font-medium">L</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((row) => (
            <tr key={row.holeNumber}>
              <td className="px-2 py-1 text-center font-medium tabular-nums">
                {row.holeNumber}
              </td>
              <td className="px-1 py-1">
                <NumericCellInput
                  type="number"
                  inputMode="numeric"
                  min={3}
                  max={5}
                  value={row.par}
                  onChange={(event) =>
                    updateRow(row.holeNumber, {
                      par: Number(event.target.value),
                    })
                  }
                />
              </td>
              {sortedTees.map((tee) => (
                <td key={tee.teeKey} className="px-1 py-1">
                  <NumericCellInput
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={row.teeYardages[tee.teeKey] ?? ""}
                    onChange={(event) =>
                      updateRow(row.holeNumber, {
                        teeYardages: {
                          ...row.teeYardages,
                          [tee.teeKey]: event.target.value,
                        },
                      })
                    }
                  />
                </td>
              ))}
              {showMensHandicap && (
                <td className="px-1 py-1">
                  <NumericCellInput
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={18}
                    value={row.strokeIndex}
                    onChange={(event) =>
                      updateRow(row.holeNumber, {
                        strokeIndex: event.target.value,
                      })
                    }
                  />
                </td>
              )}
              {showLadiesHandicap && (
                <td className="px-1 py-1">
                  <NumericCellInput
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={18}
                    value={row.ladiesStrokeIndex}
                    onChange={(event) =>
                      updateRow(row.holeNumber, {
                        ladiesStrokeIndex: event.target.value,
                      })
                    }
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/15 font-semibold">
            <td className="px-2 py-2 text-center">{totalLabel}</td>
            <td className="px-1 py-2 text-center tabular-nums">
              {sumPar(allRows, holeNumbers)}
            </td>
            {sortedTees.map((tee) => (
              <td key={tee.teeKey} className="px-1 py-2 text-center tabular-nums">
                {sumYardages(allRows, tee.teeKey, holeNumbers).toLocaleString()}
              </td>
            ))}
            {showMensHandicap && <td className="px-1 py-2" />}
            {showLadiesHandicap && <td className="px-1 py-2" />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function CourseScorecardEditTable({
  holeCount,
  rows,
  sortedTees,
  showMensHandicap,
  showLadiesHandicap,
  onRowsChange,
}: CourseScorecardEditTableProps) {
  const holeNumbers = useMemo(
    () => holeNumbersForCount(holeCount),
    [holeCount]
  );
  const frontNine = holeNumbers.filter((hole) => hole <= 9);
  const backNine = holeNumbers.filter((hole) => hole > 9);

  const frontRows = rows.filter((row) => row.holeNumber <= 9);
  const backRows = rows.filter((row) => row.holeNumber > 9);

  if (backNine.length > 0) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <ScorecardNineTable
          title="Front nine"
          totalLabel="OUT"
          holeNumbers={frontNine}
          rows={frontRows}
          allRows={rows}
          sortedTees={sortedTees}
          showMensHandicap={showMensHandicap}
          showLadiesHandicap={showLadiesHandicap}
          onRowsChange={onRowsChange}
        />
        <ScorecardNineTable
          title="Back nine"
          totalLabel="IN"
          holeNumbers={backNine}
          rows={backRows}
          allRows={rows}
          sortedTees={sortedTees}
          showMensHandicap={showMensHandicap}
          showLadiesHandicap={showLadiesHandicap}
          onRowsChange={onRowsChange}
        />
      </div>
    );
  }

  return (
    <ScorecardNineTable
      title="Holes"
      totalLabel="TOT"
      holeNumbers={holeNumbers}
      rows={rows}
      allRows={rows}
      sortedTees={sortedTees}
      showMensHandicap={showMensHandicap}
      showLadiesHandicap={showLadiesHandicap}
      onRowsChange={onRowsChange}
    />
  );
}
