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

type CourseScorecardReviewTableProps = {
  holeCount: number;
  courseHoles: CourseHole[];
  sortedTees: CourseTee[];
};

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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-2 py-2">Hole</th>
            <th className="px-2 py-2">Par</th>
            {sortedTees.map((tee) => (
              <th key={tee.teeKey} className="px-2 py-2">
                {tee.teeName}
              </th>
            ))}
            <th className="px-2 py-2">
              {handicapAvailability.hasBoth ? (
                <HandicapRowToggle
                  view={activeView}
                  onChange={setHandicapView}
                  className="text-xs"
                />
              ) : (
                handicapHeaderLabel
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {holeNumbers.map((holeNumber) => {
            const hole = courseHoles.find(
              (entry) => entry.holeNumber === holeNumber
            );
            const strokeIndex = hole
              ? strokeIndexForHandicapView(hole, activeView)
              : null;

            return (
              <tr key={holeNumber} className="border-b">
                <td className="px-2 py-2 font-medium">{holeNumber}</td>
                <td className="px-2 py-2">{hole?.par ?? "—"}</td>
                {sortedTees.map((tee) => (
                  <td key={tee.teeKey} className="px-2 py-2 tabular-nums">
                    {hole?.teeYardages?.[tee.teeKey] ?? hole?.yardage ?? "—"}
                  </td>
                ))}
                <td className="px-2 py-2 tabular-nums">
                  {strokeIndex ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {frontNine.length > 0 && (
            <tr className="border-t bg-muted/30 font-medium">
              <td className="px-2 py-2">OUT</td>
              <td className="px-2 py-2">
                {frontNine.reduce((total, holeNumber) => {
                  const hole = courseHoles.find(
                    (entry) => entry.holeNumber === holeNumber
                  );
                  return total + (hole?.par ?? 0);
                }, 0)}
              </td>
              {sortedTees.map((tee) => (
                <td key={tee.teeKey} className="px-2 py-2 tabular-nums">
                  {sumYardages(courseHoles, tee.teeKey, frontNine)}
                </td>
              ))}
              <td className="px-2 py-2" />
            </tr>
          )}
          {backNine.length > 0 && (
            <tr className="border-t bg-muted/30 font-medium">
              <td className="px-2 py-2">IN</td>
              <td className="px-2 py-2">
                {backNine.reduce((total, holeNumber) => {
                  const hole = courseHoles.find(
                    (entry) => entry.holeNumber === holeNumber
                  );
                  return total + (hole?.par ?? 0);
                }, 0)}
              </td>
              {sortedTees.map((tee) => (
                <td key={tee.teeKey} className="px-2 py-2 tabular-nums">
                  {sumYardages(courseHoles, tee.teeKey, backNine)}
                </td>
              ))}
              <td className="px-2 py-2" />
            </tr>
          )}
          <tr className="border-t bg-muted/40 font-semibold">
            <td className="px-2 py-2">TOT</td>
            <td className="px-2 py-2">
              {holeNumbers.reduce((total, holeNumber) => {
                const hole = courseHoles.find(
                  (entry) => entry.holeNumber === holeNumber
                );
                return total + (hole?.par ?? 0);
              }, 0)}
            </td>
            {sortedTees.map((tee) => (
              <td key={tee.teeKey} className="px-2 py-2 tabular-nums">
                {sumYardages(courseHoles, tee.teeKey, holeNumbers)}
              </td>
            ))}
            <td className="px-2 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
