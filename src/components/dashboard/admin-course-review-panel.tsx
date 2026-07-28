"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

import {
  rejectSubmittedCourse,
  verifySubmittedCourse,
} from "@/actions/course-onboarding";
import { CourseHolePinMap } from "@/components/dashboard/course-hole-pin-map";
import { CourseScorecardReviewTable } from "@/components/dashboard/course-scorecard-review-table";
import { HoleStrip } from "@/components/dashboard/hole-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/lib/course-onboarding";
import { sortCourseTees } from "@/lib/course-tees";
import { parseCoordinate, holeNumbersForMapping } from "@/lib/green-distance";
import { formatCourseLocationLine } from "@/lib/course-location";

type AdminCourseReviewPanelProps = {
  course: GolfCourse & {
    organization: Organization | null;
    courseTees: CourseTee[];
    courseHoles: CourseHole[];
    holeFeatures: HoleFeature[];
    greenTargets: GreenTarget[];
  };
};

export function AdminCourseReviewPanel({ course }: AdminCourseReviewPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeHole, setActiveHole] = useState(1);
  const [rejectNotes, setRejectNotes] = useState("");

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

  const mappingHoleNumbers = useMemo(
    () =>
      holeNumbersForMapping({
        holeCount: course.holeCount,
        backNineMirrorsFront: course.backNineMirrorsFront,
      }),
    [course.holeCount, course.backNineMirrorsFront]
  );
  const mappingHoleCount = mappingHoleNumbers.length;

  const mappingPercent =
    mappingProgress.requiredTeeCount > 0
      ? Math.round(
          (mappingProgress.mappedTeeCount / mappingProgress.requiredTeeCount) *
            100
        )
      : 0;

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

  const activeHolePar = course.courseHoles.find(
    (entry) => entry.holeNumber === activeHole
  )?.par;

  function isHoleMappingComplete(holeNumber: number) {
    const pins = holePins[holeNumber];
    const placedTees = pins
      ? Object.keys(pins.tees).filter((key) =>
          course.courseTees.some((tee) => tee.teeKey === key)
        ).length
      : 0;
    return mappedHoleNumbers.has(holeNumber) && placedTees >= course.courseTees.length;
  }

  function runAction(
    action: () => Promise<{ success: boolean; error?: string }>,
    redirectToList = false
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) return;
      if (redirectToList) {
        router.push("/dashboard/admin/courses");
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Course summary */}
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">
              {course.organization?.name ?? "Unknown organization"}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatCourseLocationLine({
                address: course.address,
                city: course.city,
                state: course.state,
                country: course.country,
              })}
            </p>
            {course.submittedAt && (
              <p className="text-xs text-muted-foreground">
                Submitted{" "}
                {new Date(course.submittedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{course.holeCount} holes</Badge>
            <Badge variant="outline">
              {mappingProgress.mappedHoleCount}/{mappingHoleCount} greens
            </Badge>
            <Badge variant="outline">
              {mappingProgress.mappedTeeCount}/{mappingProgress.requiredTeeCount}{" "}
              tee boxes
            </Badge>
            <Badge variant="outline" className="max-w-full">
              <span className="truncate">
                {sortedTees.map((tee) => tee.teeName).join(" · ")}
              </span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Hole mapping — full width, primary review surface */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/20 px-4 py-3 sm:px-5">
          <div className="mb-3 sm:mb-0">
            <h2 className="text-sm font-semibold sm:text-base">Hole mapping</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Review greens, tee boxes, and fairway paths hole by hole.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Hole {activeHole}
                {activeHolePar != null ? ` · Par ${activeHolePar}` : ""}
              </p>
              <span className="hidden h-4 w-px bg-border sm:inline-block" />
              <p className="text-xs text-muted-foreground">
                {mappingProgress.mappedHoleCount}/{mappingHoleCount} greens ·{" "}
                {mappingProgress.mappedTeeCount}/
                {mappingProgress.requiredTeeCount} tees
              </p>
              <div className="flex min-w-28 flex-1 items-center gap-2 sm:max-w-xs">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${mappingPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums text-primary">
                  {mappingPercent}%
                </span>
              </div>
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
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
                size="sm"
                disabled={activeHole >= mappingHoleCount}
                onClick={() => setActiveHole((current) => current + 1)}
              >
                Next hole
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>

        <HoleStrip
          holes={mappingHoleNumbers}
          activeHole={activeHole}
          onSelect={setActiveHole}
          isHoleComplete={isHoleMappingComplete}
        />

        <div className="min-h-[min(52vh,560px)] min-w-0 lg:min-h-[min(78vh,820px)]">
          <CourseHolePinMap
            readOnly
            className="h-full min-h-[min(52vh,560px)] lg:min-h-[min(78vh,820px)]"
            courseCenter={courseCenter}
            holeNumber={activeHole}
            courseTees={course.courseTees}
            initialGreen={holePins[activeHole]?.green ?? null}
            initialTees={holePins[activeHole]?.tees ?? {}}
            initialLineBreak={holePins[activeHole]?.lineBreak ?? null}
            scorecardYardages={activeHoleScorecardYardages}
            canGoPrevious={activeHole > 1}
            canGoNext={activeHole < mappingHoleCount}
            onPreviousHole={() =>
              setActiveHole((current) => Math.max(1, current - 1))
            }
            onNextHole={() =>
              setActiveHole((current) => Math.min(mappingHoleCount, current + 1))
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:hidden">
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
            {activeHole} / {mappingHoleCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 flex-1"
            disabled={activeHole >= mappingHoleCount}
            onClick={() => setActiveHole((current) => current + 1)}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </section>

      {/* Scorecard — below the map */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold sm:text-base">Scorecard</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Par, handicap, and yardages submitted by the course.
          </p>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {course.scorecardImageUrl ? (
            <a
              href={course.scorecardImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block h-48 w-full overflow-hidden rounded-lg border bg-muted/20 transition-opacity hover:opacity-90 sm:h-64"
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
          ) : (
            <p className="text-sm text-muted-foreground">
              No scorecard image uploaded.
            </p>
          )}

          <CourseScorecardReviewTable
            holeCount={course.holeCount}
            courseHoles={course.courseHoles}
            sortedTees={sortedTees}
          />
        </div>
      </section>

      {/* Approval actions */}
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold sm:text-base">Decision</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Approve to publish this course, or reject with notes for the
              course owner.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(() => verifySubmittedCourse(course.id), true)
              }
            >
              <CheckCircle2 />
              Approve and publish
            </Button>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/30 p-3 sm:flex-row sm:items-center">
            <Input
              className="bg-background sm:flex-1"
              placeholder="Rejection notes for the course owner"
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 sm:w-auto"
              disabled={isPending}
              onClick={() =>
                runAction(
                  () => rejectSubmittedCourse(course.id, rejectNotes),
                  true
                )
              }
            >
              Reject course
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
