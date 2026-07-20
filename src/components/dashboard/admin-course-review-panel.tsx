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
  holeNumbersForCount,
} from "@/lib/course-onboarding";
import { sortCourseTees } from "@/lib/course-tees";
import { parseCoordinate } from "@/lib/green-distance";
import { formatCourseLocationLine } from "@/lib/course-location";
import { cn } from "@/lib/utils";

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
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
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
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{course.holeCount} holes</Badge>
            <Badge variant="outline">
              {mappingProgress.mappedHoleCount}/{course.holeCount} greens
            </Badge>
            <Badge variant="outline">
              {mappingProgress.mappedTeeCount}/{mappingProgress.requiredTeeCount} tee boxes
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="space-y-3 rounded-lg border p-4">
          <div>
            <h2 className="font-medium">Scorecard</h2>
            <p className="text-sm text-muted-foreground">
              Par, handicap, and yardages submitted by the course.
            </p>
          </div>

          {course.scorecardImageUrl ? (
            <div className="relative h-56 w-full overflow-hidden rounded-md border bg-muted/20">
              <Image
                src={course.scorecardImageUrl}
                alt={`${course.name} scorecard`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
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
        </section>

        <section className="overflow-hidden rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Hole mapping</h2>
            <p className="text-sm text-muted-foreground">
              Review greens, tee boxes, and fairway doglegs hole by hole.
            </p>
          </div>

          <div className="grid min-h-[min(70vh,720px)] lg:grid-cols-[12rem_1fr]">
            <aside className="flex flex-col border-b bg-muted/20 lg:border-b-0 lg:border-r">
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

            <div className="min-h-[min(52vh,560px)] min-w-0 lg:min-h-0">
              <CourseHolePinMap
                readOnly
                className="h-full min-h-[min(52vh,560px)] lg:min-h-full"
                courseCenter={courseCenter}
                holeNumber={activeHole}
                courseTees={course.courseTees}
                initialGreen={holePins[activeHole]?.green ?? null}
                initialTees={holePins[activeHole]?.tees ?? {}}
                initialLineBreak={holePins[activeHole]?.lineBreak ?? null}
                scorecardYardages={activeHoleScorecardYardages}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isPending}
            onClick={() =>
              runAction(() => verifySubmittedCourse(course.id), true)
            }
          >
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
    </div>
  );
}
