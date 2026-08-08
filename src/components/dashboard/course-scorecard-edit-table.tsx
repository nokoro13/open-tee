"use client";

import { useMemo, type ComponentProps, type ReactNode } from "react";

import { buildScorecardNineSections } from "@/components/dashboard/course-scorecard-sections";
import {
  CourseScorecardNineSectionsShell,
  ScorecardNineSectionHeader,
  scorecardNineSectionTableClassName,
  SCORECARD_TABLE_BODY,
} from "@/components/dashboard/course-scorecard-nine-sections-shell";
import {
  SCORECARD_DATA_CELL,
  SCORECARD_EDIT_INPUT,
  SCORECARD_HOLE_HEADER,
  SCORECARD_ROW_LABEL,
  SCORECARD_TOTAL_CELL,
  SCORECARD_VALUE_CELL,
  SCORECARD_VALUE_SLOT,
} from "@/components/dashboard/course-scorecard-table-styles";
import { Input } from "@/components/ui/input";
import { CombinationTeeLabel } from "@/components/dashboard/combination-tee-name";
import type { CourseTeeInput } from "@/lib/course-tees";
import {
  getCombinationBaseTeeKeys,
  sortCourseTeesByTotalYardage,
  yardageCellPresentationForHole,
} from "@/lib/course-tees";
import {
  ladiesHandicapRowLabel,
  mensHandicapRowLabel,
} from "@/lib/scorecard-handicap-rows";
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

function parseNumeric(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumPar(rows: ScorecardEditRow[], holeNumbers: number[]): number {
  return holeNumbers.reduce((total, holeNumber) => {
    const row = rows.find((entry) => entry.holeNumber === holeNumber);
    return total + (row?.par ?? 0);
  }, 0);
}

function sumYardages(
  rows: ScorecardEditRow[],
  teeKey: string,
  holeNumbers: number[]
): number {
  return holeNumbers.reduce((total, holeNumber) => {
    const row = rows.find((entry) => entry.holeNumber === holeNumber);
    const value = parseNumeric(row?.teeYardages[teeKey] ?? "");
    return total + (value ?? 0);
  }, 0);
}

function holeYardageNumbers(
  rows: ScorecardEditRow[],
  holeNumber: number
): Record<string, number | null | undefined> {
  const row = rows.find((entry) => entry.holeNumber === holeNumber);
  if (!row) return {};

  return Object.fromEntries(
    Object.entries(row.teeYardages).map(([teeKey, raw]) => [
      teeKey,
      parseNumeric(raw),
    ])
  );
}

function NumericCellInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return <Input className={cn(SCORECARD_EDIT_INPUT, className)} {...props} />;
}

function EditableRow({
  label,
  holeNumbers,
  children,
  total,
  emphasizeTotal = false,
  labelClassName,
}: {
  label: ReactNode;
  holeNumbers: number[];
  children: (holeNumber: number, index: number) => ReactNode;
  total?: string | number | null;
  emphasizeTotal?: boolean;
  labelClassName?: string;
}) {
  return (
    <tr>
      <th scope="row" className={cn(SCORECARD_ROW_LABEL, labelClassName)}>
        {label}
      </th>
      {holeNumbers.map((holeNumber, index) => (
        <td key={holeNumber} className={SCORECARD_VALUE_CELL}>
          {children(holeNumber, index)}
        </td>
      ))}
      <td
        className={cn(
          SCORECARD_TOTAL_CELL,
          emphasizeTotal && total != null && "font-semibold"
        )}
      >
        {total != null ? (
          <div className={SCORECARD_VALUE_SLOT}>{total}</div>
        ) : null}
      </td>
    </tr>
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
  const sections = useMemo(
    () => buildScorecardNineSections(holeCount),
    [holeCount]
  );
  const handicapAvailability = useMemo(
    () => ({
      hasMens: showMensHandicap,
      hasLadies: showLadiesHandicap,
      hasBoth: showMensHandicap && showLadiesHandicap,
    }),
    [showLadiesHandicap, showMensHandicap]
  );
  const holesForYardageSort = useMemo(
    () =>
      rows.map((row) => ({
        teeYardages: Object.fromEntries(
          Object.entries(row.teeYardages)
            .map(([teeKey, raw]) => {
              const parsed = parseNumeric(raw);
              return parsed != null ? [teeKey, parsed] : null;
            })
            .filter((entry): entry is [string, number] => entry != null)
        ),
      })),
    [rows]
  );
  const displayTees = useMemo(
    () => sortCourseTeesByTotalYardage(sortedTees, holesForYardageSort),
    [holesForYardageSort, sortedTees]
  );

  function updateRow(holeNumber: number, patch: Partial<ScorecardEditRow>) {
    onRowsChange(
      rows.map((row) =>
        row.holeNumber === holeNumber ? { ...row, ...patch } : row
      )
    );
  }

  return (
    <CourseScorecardNineSectionsShell sections={sections}>
      {(section) => {
        const sectionPar = sumPar(rows, section.holeNumbers);

        return (
          <div className="overflow-x-auto">
            <ScorecardNineSectionHeader label={section.label} par={sectionPar} />

            <table className={scorecardNineSectionTableClassName()}>
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className={SCORECARD_HOLE_HEADER}>Hole</th>
                  {section.holeNumbers.map((holeNumber) => (
                    <th
                      key={holeNumber}
                      className={cn(SCORECARD_DATA_CELL, "font-semibold")}
                    >
                      {holeNumber}
                    </th>
                  ))}
                  <th className={SCORECARD_TOTAL_CELL}>Tot</th>
                </tr>
              </thead>
              <tbody className={SCORECARD_TABLE_BODY}>
                {displayTees.map((tee) => {
                  const sectionYardage = sumYardages(
                    rows,
                    tee.teeKey,
                    section.holeNumbers
                  );
                  const baseTeeKeys = getCombinationBaseTeeKeys(tee, displayTees);
                  const isCombination = baseTeeKeys != null;

                  return (
                    <EditableRow
                      key={tee.teeKey}
                      label={
                        isCombination ? (
                          <CombinationTeeLabel
                            teeKey={tee.teeKey}
                            teeName={tee.teeName}
                            allTees={displayTees}
                            className="normal-case tracking-normal"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                            {tee.teeColor && (
                              <span
                                className="size-2 shrink-0 rounded-full border border-black/10"
                                style={{ backgroundColor: tee.teeColor }}
                                aria-hidden
                              />
                            )}
                            {tee.teeName}
                          </span>
                        )
                      }
                      labelClassName="normal-case tracking-normal"
                      holeNumbers={section.holeNumbers}
                      total={
                        sectionYardage > 0
                          ? sectionYardage.toLocaleString()
                          : "—"
                      }
                      emphasizeTotal
                    >
                      {(holeNumber) => {
                        const row = rows.find(
                          (entry) => entry.holeNumber === holeNumber
                        );
                        if (!row) return null;

                        const holeYardages = holeYardageNumbers(rows, holeNumber);
                        const cellPresentation = yardageCellPresentationForHole(
                          tee,
                          displayTees,
                          holeYardages
                        );

                        return (
                          <div
                            className={cn(
                              "rounded-sm",
                              cellPresentation?.className
                            )}
                            style={cellPresentation?.style}
                          >
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
                          </div>
                        );
                      }}
                    </EditableRow>
                  );
                })}

                {showMensHandicap && (
                  <EditableRow
                    label={mensHandicapRowLabel(handicapAvailability)}
                    labelClassName="normal-case tracking-normal"
                    holeNumbers={section.holeNumbers}
                  >
                    {(holeNumber) => {
                      const row = rows.find(
                        (entry) => entry.holeNumber === holeNumber
                      );
                      if (!row) return null;

                      return (
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
                      );
                    }}
                  </EditableRow>
                )}

                {showLadiesHandicap && (
                  <EditableRow
                    label={ladiesHandicapRowLabel()}
                    labelClassName="normal-case tracking-normal"
                    holeNumbers={section.holeNumbers}
                  >
                    {(holeNumber) => {
                      const row = rows.find(
                        (entry) => entry.holeNumber === holeNumber
                      );
                      if (!row) return null;

                      return (
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
                      );
                    }}
                  </EditableRow>
                )}

                <EditableRow
                  label="Par"
                  holeNumbers={section.holeNumbers}
                  total={sectionPar}
                >
                  {(holeNumber) => {
                    const row = rows.find(
                      (entry) => entry.holeNumber === holeNumber
                    );
                    if (!row) return null;

                    return (
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
                    );
                  }}
                </EditableRow>
              </tbody>
            </table>
          </div>
        );
      }}
    </CourseScorecardNineSectionsShell>
  );
}
