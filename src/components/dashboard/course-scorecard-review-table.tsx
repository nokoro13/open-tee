"use client";

import { useMemo, type ReactNode } from "react";

import { CombinationTeeLabel } from "@/components/dashboard/combination-tee-name";
import { buildScorecardNineSections } from "@/components/dashboard/course-scorecard-sections";
import {
  CourseScorecardNineSectionsShell,
  ScorecardNineSectionHeader,
  scorecardNineSectionTableClassName,
  SCORECARD_TABLE_BODY,
} from "@/components/dashboard/course-scorecard-nine-sections-shell";
import {
  SCORECARD_DATA_CELL,
  SCORECARD_HOLE_HEADER,
  SCORECARD_ROW_LABEL,
  SCORECARD_TOTAL_CELL,
} from "@/components/dashboard/course-scorecard-table-styles";
import type { CourseHole, CourseTee } from "@/db/schema";
import {
  getCombinationBaseTeeKeys,
  sortCourseTeesByTotalYardage,
  yardageCellPresentationForHole,
  type TeeCellStyle,
} from "@/lib/course-tees";
import {
  ladiesHandicapRowLabel,
  mensHandicapRowLabel,
  resolveHandicapAvailability,
  strokeIndexForHandicapView,
} from "@/lib/scorecard-handicap-rows";
import { cn } from "@/lib/utils";

type CourseScorecardReviewTableProps = {
  holeCount: number;
  courseHoles: CourseHole[];
  sortedTees: CourseTee[];
};

function sumYardages(
  holes: CourseHole[],
  teeKey: string,
  holeNumbers: number[]
): number {
  return holeNumbers.reduce((total, holeNumber) => {
    const hole = holes.find((entry) => entry.holeNumber === holeNumber);
    const yardage = hole?.teeYardages?.[teeKey] ?? hole?.yardage;
    return total + (yardage ?? 0);
  }, 0);
}

function sumPar(holes: CourseHole[], holeNumbers: number[]): number {
  return holeNumbers.reduce((total, holeNumber) => {
    const hole = holes.find((entry) => entry.holeNumber === holeNumber);
    return total + (hole?.par ?? 0);
  }, 0);
}

function holeTeeYardageNumbers(
  hole: CourseHole | undefined
): Record<string, number | null | undefined> {
  if (!hole?.teeYardages) return {};
  return Object.fromEntries(
    Object.entries(hole.teeYardages).map(([teeKey, yardage]) => [
      teeKey,
      yardage ?? null,
    ])
  );
}

function ScorecardValueRow({
  label,
  values,
  total,
  emphasizeTotal = false,
  labelClassName,
  getCellProps,
}: {
  label: ReactNode;
  values: (string | number | null)[];
  total?: string | number | null;
  emphasizeTotal?: boolean;
  labelClassName?: string;
  getCellProps?: (index: number) => {
    className?: string;
    style?: TeeCellStyle;
  } | null;
}) {
  return (
    <tr>
      <th scope="row" className={cn(SCORECARD_ROW_LABEL, labelClassName)}>
        {label}
      </th>
      {values.map((value, index) => {
        const cellProps = getCellProps?.(index);
        return (
          <td
            key={index}
            className={cn(SCORECARD_DATA_CELL, cellProps?.className)}
            style={cellProps?.style}
          >
            {value ?? "—"}
          </td>
        );
      })}
      <td
        className={cn(
          SCORECARD_TOTAL_CELL,
          emphasizeTotal && total != null && "font-semibold"
        )}
      >
        {total ?? null}
      </td>
    </tr>
  );
}

export function CourseScorecardReviewTable({
  holeCount,
  courseHoles,
  sortedTees,
}: CourseScorecardReviewTableProps) {
  const sections = useMemo(
    () => buildScorecardNineSections(holeCount),
    [holeCount]
  );
  const handicapAvailability = useMemo(
    () => resolveHandicapAvailability(courseHoles),
    [courseHoles]
  );
  const displayTees = useMemo(
    () => sortCourseTeesByTotalYardage(sortedTees, courseHoles),
    [courseHoles, sortedTees]
  );

  return (
    <CourseScorecardNineSectionsShell sections={sections}>
      {(section) => {
        const sectionPar = sumPar(courseHoles, section.holeNumbers);

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
                    courseHoles,
                    tee.teeKey,
                    section.holeNumbers
                  );
                  const isCombination =
                    getCombinationBaseTeeKeys(tee, displayTees) != null;

                  return (
                    <ScorecardValueRow
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
                      values={section.holeNumbers.map((holeNumber) => {
                        const hole = courseHoles.find(
                          (entry) => entry.holeNumber === holeNumber
                        );
                        return (
                          hole?.teeYardages?.[tee.teeKey] ??
                          hole?.yardage ??
                          null
                        );
                      })}
                      getCellProps={(index) => {
                        const holeNumber = section.holeNumbers[index]!;
                        const hole = courseHoles.find(
                          (entry) => entry.holeNumber === holeNumber
                        );
                        return yardageCellPresentationForHole(
                          tee,
                          displayTees,
                          holeTeeYardageNumbers(hole)
                        );
                      }}
                      total={
                        sectionYardage > 0
                          ? sectionYardage.toLocaleString()
                          : null
                      }
                      emphasizeTotal
                    />
                  );
                })}
                {handicapAvailability.hasMens && (
                  <ScorecardValueRow
                    label={mensHandicapRowLabel(handicapAvailability)}
                    labelClassName="normal-case tracking-normal"
                    values={section.holeNumbers.map((holeNumber) => {
                      const hole = courseHoles.find(
                        (entry) => entry.holeNumber === holeNumber
                      );
                      return hole
                        ? strokeIndexForHandicapView(hole, "mens")
                        : null;
                    })}
                    total={null}
                  />
                )}
                {handicapAvailability.hasLadies && (
                  <ScorecardValueRow
                    label={ladiesHandicapRowLabel()}
                    labelClassName="normal-case tracking-normal"
                    values={section.holeNumbers.map((holeNumber) => {
                      const hole = courseHoles.find(
                        (entry) => entry.holeNumber === holeNumber
                      );
                      return hole
                        ? strokeIndexForHandicapView(hole, "ladies")
                        : null;
                    })}
                    total={null}
                  />
                )}
                <ScorecardValueRow
                  label="Par"
                  values={section.holeNumbers.map((holeNumber) => {
                    const hole = courseHoles.find(
                      (entry) => entry.holeNumber === holeNumber
                    );
                    return hole?.par ?? null;
                  })}
                  total={sectionPar}
                />
              </tbody>
            </table>
          </div>
        );
      }}
    </CourseScorecardNineSectionsShell>
  );
}
