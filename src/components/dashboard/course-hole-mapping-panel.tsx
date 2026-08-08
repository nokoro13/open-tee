"use client";

import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Flag, MapPinned } from "lucide-react";

import { CourseHolePinMap } from "@/components/dashboard/course-hole-pin-map";
import { DashboardSectionCard } from "@/components/dashboard/dashboard-section-card";
import { HoleStrip } from "@/components/dashboard/hole-strip";
import { Button } from "@/components/ui/button";
import type { CourseTee } from "@/db/schema";
import type { CourseMappingProgress } from "@/lib/course-onboarding";
import type { LatLng } from "@/lib/green-distance";
import { cn } from "@/lib/utils";

type CourseHoleMappingPanelProps = {
  title?: string;
  description?: string;
  mappingHoleNumbers: number[];
  activeHole: number;
  onActiveHoleChange: (hole: number) => void;
  isHoleComplete?: (holeNumber: number) => boolean;
  mappingHoleCount: number;
  activeHolePar?: number | null;
  activeHoleYardage?: number | null;
  courseCenter: LatLng;
  courseTees: CourseTee[];
  initialGreen: LatLng | null;
  initialTees: Record<string, LatLng>;
  initialLineBreaks?: LatLng[];
  initialLineBreak?: LatLng | null;
  scorecardYardages?: Record<string, number>;
  readOnly?: boolean;
  isSaving?: boolean;
  onSavePin?: React.ComponentProps<typeof CourseHolePinMap>["onSavePin"];
  mappingProgress?: CourseMappingProgress;
  showProgress?: boolean;
  headerActions?: React.ReactNode;
  footerExtra?: React.ReactNode;
  backNineMirrorsFront?: boolean;
  className?: string;
  /** Viewport space to reserve outside the map (headers, tabs, card chrome). */
  viewportOffset?: string;
};

function mappingPercent(progress: CourseMappingProgress): number {
  if (progress.requiredTeeCount <= 0) return 0;
  return Math.round(
    (progress.mappedTeeCount / progress.requiredTeeCount) * 100
  );
}

export function CourseHoleMappingPanel({
  title = "Hole map",
  description = "Verified greens, tee boxes, and fairway lines.",
  mappingHoleNumbers,
  activeHole,
  onActiveHoleChange,
  isHoleComplete,
  mappingHoleCount,
  activeHolePar,
  activeHoleYardage,
  courseCenter,
  courseTees,
  initialGreen,
  initialTees,
  initialLineBreaks,
  initialLineBreak = null,
  scorecardYardages,
  readOnly = false,
  isSaving = false,
  onSavePin,
  mappingProgress,
  showProgress = false,
  headerActions,
  footerExtra,
  backNineMirrorsFront = false,
  className,
  viewportOffset = "18rem",
}: CourseHoleMappingPanelProps) {
  const progressPercent =
    mappingProgress != null ? mappingPercent(mappingProgress) : 0;

  return (
    <DashboardSectionCard
      icon={MapPinned}
      title={title}
      description={description}
      className={className}
      style={
        {
          "--mapping-viewport-offset": viewportOffset,
        } as CSSProperties
      }
      headerExtra={
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm font-medium tabular-nums">
            <Flag className="size-3.5 text-primary" />
            Hole {activeHole}
          </span>
          {(activeHolePar != null || activeHoleYardage != null) && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {[
                activeHolePar != null ? `Par ${activeHolePar}` : null,
                activeHoleYardage != null
                  ? `${activeHoleYardage.toLocaleString()} yds`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
      }
      headerFooter={
        showProgress && mappingProgress ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-xs text-muted-foreground">
              {mappingProgress.mappedHoleCount}/{mappingHoleCount} greens ·{" "}
              {mappingProgress.mappedTeeCount}/
              {mappingProgress.requiredTeeCount} tees
            </p>
            <div className="flex min-w-28 flex-1 items-center gap-2 sm:max-w-xs">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums text-primary">
                {progressPercent}%
              </span>
            </div>
            {headerActions ? (
              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                {headerActions}
              </div>
            ) : null}
          </div>
        ) : null
      }
    >
      <HoleStrip
        holes={mappingHoleNumbers}
        activeHole={activeHole}
        onSelect={onActiveHoleChange}
        isHoleComplete={isHoleComplete}
        className="border-b bg-muted/10"
      />

      <div className="h-[clamp(260px,calc(100dvh-var(--mapping-viewport-offset)),480px)] w-full">
        <CourseHolePinMap
          readOnly={readOnly}
          isSaving={isSaving}
          onSavePin={onSavePin}
          className="h-full w-full"
          courseCenter={courseCenter}
          holeNumber={activeHole}
          courseTees={courseTees}
          initialGreen={initialGreen}
          initialTees={initialTees}
          initialLineBreaks={
            initialLineBreaks ??
            (initialLineBreak ? [initialLineBreak] : undefined)
          }
          initialLineBreak={initialLineBreak}
          scorecardYardages={scorecardYardages}
          canGoPrevious={activeHole > 1}
          canGoNext={activeHole < mappingHoleCount}
          onPreviousHole={() =>
            onActiveHoleChange(Math.max(1, activeHole - 1))
          }
          onNextHole={() =>
            onActiveHoleChange(Math.min(mappingHoleCount, activeHole + 1))
          }
        />
      </div>

      <div className="space-y-2 border-t bg-muted/10 px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 flex-1 sm:flex-none"
              disabled={activeHole <= 1}
              onClick={() => onActiveHoleChange(activeHole - 1)}
            >
              <ChevronLeft />
              Previous
            </Button>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {activeHole} of {mappingHoleCount}
              {backNineMirrorsFront && (
                <span className="hidden text-muted-foreground sm:inline">
                  {" "}
                  (18-hole scorecard)
                </span>
              )}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 flex-1 sm:flex-none"
              disabled={activeHole >= mappingHoleCount}
              onClick={() => onActiveHoleChange(activeHole + 1)}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
          {footerExtra ? (
            <div className={cn(showProgress && "lg:hidden")}>{footerExtra}</div>
          ) : null}
      </div>
    </DashboardSectionCard>
  );
}
