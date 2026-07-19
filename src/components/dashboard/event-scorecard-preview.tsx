"use client";

import { useMemo, useState, type ReactNode } from "react";

import { HandicapRowToggle } from "@/components/dashboard/handicap-row-toggle";
import type { ScorecardHoleSnapshot } from "@/lib/scorecard";
import { totalPar } from "@/lib/scorecard";
import {
  activeHandicapView,
  defaultHandicapView,
  handicapRowLabel,
  resolveHandicapAvailability,
  strokeIndexForHandicapView,
  type HandicapView,
} from "@/lib/scorecard-handicap-rows";
import { cn } from "@/lib/utils";

type EventScorecardPreviewProps = {
  holes: ScorecardHoleSnapshot[];
  teeName?: string | null;
  teeColor?: string | null;
  courseRating?: string | null;
  courseSlope?: number | null;
  totalYardage?: number | null;
  className?: string;
};

function sumYardages(holes: ScorecardHoleSnapshot[]): number {
  return holes.reduce((total, hole) => total + (hole.yardage ?? 0), 0);
}

function formatRatingSummary(
  courseRating?: string | null,
  courseSlope?: number | null
): string | null {
  if (courseRating && courseSlope != null) {
    return `${courseRating}/${courseSlope}`;
  }
  return null;
}

function ScorecardRow({
  label,
  values,
  totalLabel,
  totalValue,
  emphasizeTotal = false,
  className,
}: {
  label: ReactNode;
  values: (string | number | null)[];
  totalLabel?: string;
  totalValue?: string | number | null;
  emphasizeTotal?: boolean;
  className?: string;
}) {
  return (
    <tr className={className}>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </th>
      {values.map((value, index) => (
        <td
          key={`${label}-${index}`}
          className="min-w-[2.25rem] px-1.5 py-1.5 text-center text-xs tabular-nums"
        >
          {value ?? "—"}
        </td>
      ))}
      {totalLabel != null && (
        <td
          className={cn(
            "min-w-[2.75rem] border-l px-2 py-1.5 text-center text-xs tabular-nums",
            emphasizeTotal && "font-semibold"
          )}
        >
          {totalValue ?? "—"}
        </td>
      )}
    </tr>
  );
}

export function EventScorecardPreview({
  holes,
  teeName,
  teeColor,
  courseRating,
  courseSlope,
  totalYardage,
  className,
}: EventScorecardPreviewProps) {
  const parTotal = useMemo(() => totalPar(holes), [holes]);
  const yardageTotal = useMemo(
    () => totalYardage ?? sumYardages(holes),
    [holes, totalYardage]
  );
  const ratingSummary = formatRatingSummary(courseRating, courseSlope);
  const handicapAvailability = useMemo(
    () => resolveHandicapAvailability(holes),
    [holes]
  );
  const [handicapView, setHandicapView] = useState<HandicapView>(() =>
    defaultHandicapView(handicapAvailability)
  );
  const activeView = activeHandicapView(handicapView, handicapAvailability);
  const handicapLabel = handicapRowLabel(handicapAvailability);
  const showHandicapRow =
    handicapAvailability.hasMens || handicapAvailability.hasLadies;
  const showNineTotals = holes.length === 18;
  const frontNine = showNineTotals ? holes.slice(0, 9) : holes;
  const backNine = showNineTotals ? holes.slice(9, 18) : [];

  const sections = showNineTotals
    ? [
        { label: "Front", holes: frontNine, totalPar: totalPar(frontNine) },
        { label: "Back", holes: backNine, totalPar: totalPar(backNine) },
      ]
    : [{ label: null, holes, totalPar: parTotal }];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Scorecard preview</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>Par {parTotal}</span>
            {yardageTotal > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{yardageTotal.toLocaleString()} yds</span>
              </>
            )}
            {ratingSummary && (
              <>
                <span aria-hidden>·</span>
                <span>{ratingSummary}</span>
              </>
            )}
          </div>
        </div>
        {teeName && (
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
            {teeColor && (
              <span
                className="size-2.5 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: teeColor }}
                aria-hidden
              />
            )}
            {teeName} tees
          </div>
        )}
      </div>

      <div className="divide-y">
        {sections.map((section) => {
          const sectionYardage = sumYardages(section.holes);

          return (
            <div key={section.label ?? "nine"} className="overflow-x-auto">
              {section.label && (
                <div className="flex items-center justify-between bg-muted/10 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>{section.label} nine</span>
                  <span className="normal-case tracking-normal">
                    Par {section.totalPar}
                    {sectionYardage > 0
                      ? ` · ${sectionYardage.toLocaleString()} yds`
                      : ""}
                  </span>
                </div>
              )}
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b bg-muted/10">
                    <th className="sticky left-0 z-10 bg-muted/10 px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Hole
                    </th>
                    {section.holes.map((hole) => (
                      <th
                        key={`hole-${hole.holeNumber}`}
                        className="min-w-[2.25rem] px-1.5 py-1.5 text-center text-xs font-semibold tabular-nums"
                      >
                        {hole.holeNumber}
                      </th>
                    ))}
                    <th className="min-w-[2.75rem] border-l px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Tot
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <ScorecardRow
                    label="Par"
                    values={section.holes.map((hole) => hole.par)}
                    totalLabel="Tot"
                    totalValue={section.totalPar}
                  />
                  <ScorecardRow
                    label="Yds"
                    values={section.holes.map((hole) => hole.yardage ?? null)}
                    totalLabel="Tot"
                    totalValue={
                      sectionYardage > 0
                        ? sectionYardage.toLocaleString()
                        : null
                    }
                    emphasizeTotal
                  />
                  {showHandicapRow && (
                    <ScorecardRow
                      label={
                        handicapAvailability.hasBoth ? (
                          <HandicapRowToggle
                            view={activeView}
                            onChange={setHandicapView}
                          />
                        ) : (
                          handicapLabel
                        )
                      }
                      values={section.holes.map((hole) =>
                        strokeIndexForHandicapView(hole, activeView)
                      )}
                    />
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
