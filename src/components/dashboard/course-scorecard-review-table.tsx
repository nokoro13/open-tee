"use client";

import { useMemo, useState } from "react";

import { HandicapRowToggle } from "@/components/dashboard/handicap-row-toggle";
import type { CourseHole, CourseTee } from "@/db/schema";
import { holeNumbersForCount } from "@/lib/course-onboarding";
import {
  activeHandicapView,
  defaultHandicapView,
  handicapRowLabel,
  resolveHandicapAvailability,
  strokeIndexForHandicapView,
  type HandicapView,
} from "@/lib/scorecard-handicap-rows";
import { cn } from "@/lib/utils";

type CourseScorecardReviewTableProps = {
  holeCount: number;
  courseHoles: CourseHole[];
  sortedTees: CourseTee[];
};

/**
 * Sticky first column with an opaque background so horizontally scrolled
 * columns never show through. Rows rely on hairlines and type weight instead
 * of fills so the sticky cell always matches its row.
 */
const STICKY_CELL =
  "sticky left-0 z-10 bg-card px-3 py-2 whitespace-nowrap after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border";

function sumYardages(
  holes: CourseHole[],
  teeKey: string,
  range: number[]
): number {
  return range.reduce((total, holeNumber) => {
    const hole = holes.find((entry) => entry.holeNumber === holeNumber);
    const yardage = hole?.teeYardages?.[teeKey] ?? hole?.yardage;
    return total + (yardage ?? 0);
  }, 0);
}

function sumPar(holes: CourseHole[], range: number[]): number {
  return range.reduce((total, holeNumber) => {
    const hole = holes.find((entry) => entry.holeNumber === holeNumber);
    return total + (hole?.par ?? 0);
  }, 0);
}

export function CourseScorecardReviewTable({
  holeCount,
  courseHoles,
  sortedTees,
}: CourseScorecardReviewTableProps) {
  const handicapAvailability = useMemo(
    () => resolveHandicapAvailability(courseHoles),
    [courseHoles]
  );
  const [handicapView, setHandicapView] = useState<HandicapView>(() =>
    defaultHandicapView(handicapAvailability)
  );

  const activeView = activeHandicapView(handicapView, handicapAvailability);
  const handicapHeaderLabel = handicapRowLabel(handicapAvailability);

  const holeNumbers = useMemo(
    () => holeNumbersForCount(holeCount),
    [holeCount]
  );
  const frontNine = holeNumbers.filter((hole) => hole <= 9);
  const backNine = holeNumbers.filter((hole) => hole > 9);

  const totalRows: { label: string; range: number[]; emphasize?: boolean }[] = [
    ...(frontNine.length > 0 && backNine.length > 0
      ? [
          { label: "OUT", range: frontNine },
          { label: "IN", range: backNine },
        ]
      : []),
    { label: "TOT", range: holeNumbers, emphasize: true },
  ];

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className={cn(STICKY_CELL, "font-medium")}>Hole</th>
              <th className="px-3 py-2 font-medium">Par</th>
              {sortedTees.map((tee) => (
                <th
                  key={tee.teeKey}
                  className="whitespace-nowrap px-3 py-2 font-medium"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {tee.teeColor && (
                      <span
                        className="size-2 shrink-0 rounded-full border border-black/10"
                        style={{ backgroundColor: tee.teeColor }}
                        aria-hidden
                      />
                    )}
                    {tee.teeName}
                  </span>
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-2 font-medium normal-case">
                {handicapAvailability.hasBoth ? (
                  <HandicapRowToggle
                    view={activeView}
                    onChange={setHandicapView}
                  />
                ) : (
                  <span className="uppercase">{handicapHeaderLabel}</span>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {holeNumbers.map((holeNumber) => {
              const hole = courseHoles.find(
                (entry) => entry.holeNumber === holeNumber
              );
              const strokeIndex = hole
                ? strokeIndexForHandicapView(hole, activeView)
                : null;

              return (
                <tr key={holeNumber}>
                  <td className={cn(STICKY_CELL, "font-medium tabular-nums")}>
                    {holeNumber}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{hole?.par ?? "—"}</td>
                  {sortedTees.map((tee) => (
                    <td key={tee.teeKey} className="px-3 py-2 tabular-nums">
                      {hole?.teeYardages?.[tee.teeKey] ?? hole?.yardage ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 tabular-nums">{strokeIndex ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {totalRows.map((row) => (
              <tr
                key={row.label}
                className={cn(
                  "border-t",
                  row.emphasize ? "font-semibold" : "font-medium text-muted-foreground"
                )}
              >
                <td
                  className={cn(
                    STICKY_CELL,
                    row.emphasize ? "font-semibold" : "font-medium"
                  )}
                >
                  {row.label}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {sumPar(courseHoles, row.range)}
                </td>
                {sortedTees.map((tee) => (
                  <td key={tee.teeKey} className="px-3 py-2 tabular-nums">
                    {sumYardages(courseHoles, tee.teeKey, row.range).toLocaleString()}
                  </td>
                ))}
                <td className="px-3 py-2" />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
