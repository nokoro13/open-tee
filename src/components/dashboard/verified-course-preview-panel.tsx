"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

import { CourseHolePinMap } from "@/components/dashboard/course-hole-pin-map";
import { CourseScorecardReviewTable } from "@/components/dashboard/course-scorecard-review-table";
import { HoleStrip } from "@/components/dashboard/hole-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  CourseHole,
  CourseTee,
  GolfCourse,
  GreenTarget,
  HoleFeature,
  Organization,
} from "@/db/schema";
import {
  countCourseMappingProgress,
  extractHolePinsFromFeatures,
  holeNumbersForCount,
} from "@/lib/course-onboarding";
import { sortCourseTees } from "@/lib/course-tees";
import { formatCourseLocationLine } from "@/lib/course-location";
import { parseCoordinate } from "@/lib/green-distance";
import { cn } from "@/lib/utils";

type VerifiedCoursePreviewPanelProps = {
  course: GolfCourse & {
    organization: Organization | null;
    courseTees: CourseTee[];
    courseHoles: CourseHole[];
    holeFeatures: HoleFeature[];
    greenTargets: GreenTarget[];
  };
};

export function VerifiedCoursePreviewPanel({
  course,
}: VerifiedCoursePreviewPanelProps) {
  const [activeHole, setActiveHole] = useState(1);

  const sortedTees = useMemo(() => sortCourseTees(course.courseTees), [course.courseTees]);
  const holePins = useMemo(
    () => extractHolePinsFromFeatures(course.holeFeatures),
    [course.holeFeatures]
  );
  const mappingProgress = useMemo(
    () =>
      countCourseMappingProgress(
        course,
        course.courseTees,
        course.greenTargets,
        course.holeFeatures
      ),
    [course]
  );
  const mappedHoleNumbers = useMemo(
    () =>
      new Set(
        course.greenTargets
          .filter((target) => target.targetType === "middle")
          .map((target) => target.holeNumber)
      ),
    [course.greenTargets]
  );

  const courseCenter = useMemo(() => {
    const lat = parseCoordinate(course.latitude);
    const lng = parseCoordinate(course.longitude);
    return lat != null && lng != null ? { lat, lng } : { lat: 0, lng: 0 };
  }, [course.latitude, course.longitude]);

  const holeNumbers = useMemo(
    () => holeNumbersForCount(course.holeCount),
    [course.holeCount]
  );

  const frontNine = holeNumbers.filter((hole) => hole <= 9);
  const backNine = holeNumbers.filter((hole) => hole > 9);

  const activeHoleScorecardYardages = useMemo(() => {
    const hole = course.courseHoles.find(
      (entry) => entry.holeNumber === activeHole
    );
    if (!hole) return {};

    return Object.fromEntries(
      sortedTees
        .map((tee) => {
          const yardage = hole.teeYardages?.[tee.teeKey] ?? hole.yardage;
          return yardage != null ? [tee.teeKey, yardage] : null;
        })
        .filter((entry): entry is [string, number] => entry != null)
    );
  }, [activeHole, course.courseHoles, sortedTees]);

  function isHoleMappingComplete(holeNumber: number) {
    const pins = holePins[holeNumber];
    const placedTees = pins
      ? Object.keys(pins.tees).filter((key) =>
          course.courseTees.some((tee) => tee.teeKey === key)
        ).length
      : 0;
    return mappedHoleNumbers.has(holeNumber) && placedTees >= course.courseTees.length;
  }

  const activeHolePar = course.courseHoles.find(
    (entry) => entry.holeNumber === activeHole
  )?.par;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Course summary */}
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground">
              {formatCourseLocationLine({
                address: course.address,
                city: course.city,
                state: course.state,
                country: course.country,
              })}
            </p>
            {course.verifiedAt && (
              <p className="text-xs text-muted-foreground">
                Verified{" "}
                {new Date(course.verifiedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="default">Verified</Badge>
            <Badge variant="outline">{course.holeCount} holes</Badge>
            <Badge variant="outline">
              {mappingProgress.mappedHoleCount}/{course.holeCount} mapped
            </Badge>
            <Badge variant="outline" className="max-w-full">
              <span className="truncate">
                {sortedTees.map((tee) => tee.teeName).join(" · ")}
              </span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Scorecard */}
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold sm:text-base">Scorecard</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Official par, handicap, and yardages for this course.
            </p>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {course.scorecardImageUrl ? (
              <a
                href={course.scorecardImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block h-40 w-full overflow-hidden rounded-lg border bg-muted/20 transition-opacity hover:opacity-90 sm:h-56"
                aria-label="Open scorecard image in a new tab"
              >
                <Image
                  src={course.scorecardImageUrl}
                  alt={`${course.name} scorecard`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </a>
            ) : null}

            <CourseScorecardReviewTable
              holeCount={course.holeCount}
              courseHoles={course.courseHoles}
              sortedTees={sortedTees}
            />
          </div>
        </section>

        {/* Hole map */}
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold sm:text-base">Hole map</h2>
              <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
                Verified greens, tee boxes, and fairway lines.
              </p>
            </div>
            <p className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
              Hole {activeHole}
              {activeHolePar != null ? ` · Par ${activeHolePar}` : ""}
            </p>
          </div>

          {/* Mobile: horizontal hole strip */}
          <div className="border-b bg-muted/20 lg:hidden">
            <HoleStrip
              holes={holeNumbers}
              activeHole={activeHole}
              onSelect={setActiveHole}
              isHoleComplete={isHoleMappingComplete}
            />
          </div>

          <div className="grid lg:min-h-[min(70vh,720px)] lg:grid-cols-[12rem_1fr]">
            {/* Desktop: hole sidebar */}
            <aside className="hidden flex-col border-r bg-muted/20 lg:flex">
              <div className="space-y-4 overflow-y-auto px-3 py-3">
                {[
                  { label: "Front nine", holes: frontNine },
                  { label: "Back nine", holes: backNine },
                ]
                  .filter((section) => section.holes.length > 0)
                  .map((section) => (
                    <div key={section.label}>
                      <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {section.label}
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {section.holes.map((holeNumber) => {
                          const complete = isHoleMappingComplete(holeNumber);
                          const isActive = activeHole === holeNumber;

                          return (
                            <button
                              key={holeNumber}
                              type="button"
                              onClick={() => setActiveHole(holeNumber)}
                              className={cn(
                                "relative flex h-9 items-center justify-center rounded-md text-sm font-medium transition-colors",
                                isActive
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "bg-background/80 text-foreground ring-1 ring-foreground/10 hover:bg-background",
                                complete && !isActive && "ring-primary/30"
                              )}
                            >
                              {holeNumber}
                              {complete && (
                                <CheckCircle2
                                  className={cn(
                                    "absolute -right-1 -top-1 size-3.5",
                                    isActive
                                      ? "text-primary-foreground"
                                      : "text-primary"
                                  )}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>

              <div className="mt-auto border-t p-3">
                <div className="grid grid-cols-[auto_1fr_auto] gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={activeHole <= 1}
                    onClick={() => setActiveHole((current) => current - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={activeHole >= course.holeCount}
                    onClick={() => setActiveHole((current) => current + 1)}
                  >
                    Next hole
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={activeHole >= course.holeCount}
                    onClick={() => setActiveHole((current) => current + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </aside>

            <div className="min-h-[min(55vh,480px)] min-w-0 lg:min-h-0">
              <CourseHolePinMap
                readOnly
                className="h-full min-h-[min(55vh,480px)] lg:min-h-full"
                courseCenter={courseCenter}
                holeNumber={activeHole}
                courseTees={course.courseTees}
                initialGreen={holePins[activeHole]?.green ?? null}
                initialTees={holePins[activeHole]?.tees ?? {}}
                initialLineBreak={holePins[activeHole]?.lineBreak ?? null}
                scorecardYardages={activeHoleScorecardYardages}
                canGoPrevious={activeHole > 1}
                canGoNext={activeHole < course.holeCount}
                onPreviousHole={() =>
                  setActiveHole((current) => Math.max(1, current - 1))
                }
                onNextHole={() =>
                  setActiveHole((current) =>
                    Math.min(course.holeCount, current + 1)
                  )
                }
              />
            </div>
          </div>

          {/* Mobile: prev / next bar */}
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 flex-1"
              disabled={activeHole <= 1}
              onClick={() => setActiveHole((current) => current - 1)}
            >
              <ChevronLeft />
              Previous
            </Button>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {activeHole} / {course.holeCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 flex-1"
              disabled={activeHole >= course.holeCount}
              onClick={() => setActiveHole((current) => current + 1)}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
