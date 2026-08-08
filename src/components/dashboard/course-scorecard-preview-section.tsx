"use client";

import Image from "next/image";
import { useMemo } from "react";
import { ExternalLink, Maximize2, TableProperties } from "lucide-react";

import { CourseScorecardReviewTable } from "@/components/dashboard/course-scorecard-review-table";
import { DashboardSectionCard } from "@/components/dashboard/dashboard-section-card";
import type { CourseHole, CourseTee } from "@/db/schema";
import { holeNumbersForCount } from "@/lib/course-onboarding";
import type { CourseTeeInput } from "@/lib/course-tees";
import { cn } from "@/lib/utils";

type CourseScorecardPreviewSectionProps = {
  courseName: string;
  holeCount: number;
  courseHoles?: CourseHole[];
  sortedTees: Array<CourseTee | CourseTeeInput>;
  scorecardImageUrl?: string | null;
  title?: string;
  description?: string;
  emptyImageMessage?: string;
  headerActions?: React.ReactNode;
  imageActions?: React.ReactNode;
  emptyImage?: React.ReactNode;
  onImageClick?: () => void;
  table?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

function sumPar(holes: CourseHole[], range: number[]): number {
  return range.reduce((total, holeNumber) => {
    const hole = holes.find((entry) => entry.holeNumber === holeNumber);
    return total + (hole?.par ?? 0);
  }, 0);
}

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

export function CourseScorecardPreviewSection({
  courseName,
  holeCount,
  courseHoles = [],
  sortedTees,
  scorecardImageUrl,
  title = "Scorecard",
  description = "Official par, handicap, and yardages for this course.",
  emptyImageMessage = "No scorecard image uploaded.",
  headerActions,
  imageActions,
  emptyImage,
  onImageClick,
  table,
  footer,
  className,
}: CourseScorecardPreviewSectionProps) {
  const holeNumbers = useMemo(
    () => holeNumbersForCount(holeCount),
    [holeCount]
  );
  const parTotal = useMemo(
    () => sumPar(courseHoles, holeNumbers),
    [courseHoles, holeNumbers]
  );
  const primaryTee = sortedTees[0];
  const primaryYardage = useMemo(() => {
    if (!primaryTee) return null;
    const total = sumYardages(courseHoles, primaryTee.teeKey, holeNumbers);
    return total > 0 ? total : null;
  }, [courseHoles, holeNumbers, primaryTee]);

  const defaultHeaderExtra =
    sortedTees.length > 0 || parTotal > 0 ? (
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {parTotal > 0 && (
            <span className="rounded-full border bg-background px-3 py-1 font-medium tabular-nums text-foreground">
              Par {parTotal}
            </span>
          )}
          {primaryYardage != null && primaryTee && (
            <span className="rounded-full border bg-background px-3 py-1 font-medium tabular-nums text-foreground">
              {primaryYardage.toLocaleString()} yds
            </span>
          )}
        </div>
        {sortedTees.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {sortedTees.map((tee) => (
              <span
                key={tee.teeKey}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium"
              >
                {tee.teeColor && (
                  <span
                    className="size-2 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: tee.teeColor }}
                    aria-hidden
                  />
                )}
                {tee.teeName}
              </span>
            ))}
          </div>
        )}
      </div>
    ) : null;

  const tableContent =
    table ??
    (courseHoles.length > 0 ? (
      <CourseScorecardReviewTable
        holeCount={holeCount}
        courseHoles={courseHoles}
        sortedTees={sortedTees as CourseTee[]}
      />
    ) : null);

  const imageClassName =
    "relative block aspect-4/3 min-h-[min(45vh,480px)] w-full overflow-hidden border-b bg-muted/20 sm:aspect-21/9 sm:min-h-[min(50vh,560px)]";

  return (
    <DashboardSectionCard
      icon={TableProperties}
      title={title}
      description={description}
      className={className}
      headerExtra={headerActions ?? defaultHeaderExtra}
    >
      {scorecardImageUrl ? (
        onImageClick ? (
          <button
            type="button"
            className={cn(imageClassName, "group cursor-pointer text-left")}
            onClick={onImageClick}
            aria-label="Expand scorecard image"
          >
            <Image
              src={scorecardImageUrl}
              alt={`${courseName} scorecard`}
              fill
              className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.01] sm:p-5"
              unoptimized
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 px-4 py-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
                <Maximize2 className="size-4" />
                Expand scorecard
              </span>
            </div>
          </button>
        ) : (
          <a
            href={scorecardImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(imageClassName, "group")}
            aria-label="Open scorecard image in a new tab"
          >
            <Image
              src={scorecardImageUrl}
              alt={`${courseName} scorecard`}
              fill
              className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.01] sm:p-5"
              unoptimized
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 px-4 py-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
                <Maximize2 className="size-4" />
                View full size
                <ExternalLink className="size-3.5 opacity-70" />
              </span>
            </div>
          </a>
        )
      ) : emptyImage ? (
        emptyImage
      ) : (
        <div className="flex aspect-4/3 min-h-48 items-center justify-center border-b bg-muted/10 px-6 text-center sm:aspect-21/9">
          <p className="text-sm text-muted-foreground">{emptyImageMessage}</p>
        </div>
      )}

      {imageActions ? (
        <div className="border-b bg-muted/10 px-4 py-3 sm:px-5">{imageActions}</div>
      ) : null}

      {tableContent ? (
        <div className="space-y-4 p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hole-by-hole data
          </p>
          {tableContent}
        </div>
      ) : null}

      {footer}
    </DashboardSectionCard>
  );
}
