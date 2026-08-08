"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import {
  rejectSubmittedCourse,
  verifySubmittedCourse,
} from "@/actions/course-onboarding";
import { CourseHoleMappingPanel } from "@/components/dashboard/course-hole-mapping-panel";
import { CourseScorecardPreviewSection } from "@/components/dashboard/course-scorecard-preview-section";
import { DashboardSectionCard } from "@/components/dashboard/dashboard-section-card";
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
import { sortCourseTees, isHoleMappingCompleteForTees } from "@/lib/course-tees";
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

  const activeHoleData = course.courseHoles.find(
    (entry) => entry.holeNumber === activeHole
  );
  const activeHolePar = activeHoleData?.par;
  const activeHoleYardage =
    activeHoleScorecardYardages[sortedTees[0]?.teeKey ?? ""] ??
    activeHoleData?.yardage;

  function isHoleMappingComplete(holeNumber: number) {
    const pins = holePins[holeNumber];
    return isHoleMappingCompleteForTees(
      mappedHoleNumbers.has(holeNumber),
      pins ? Object.keys(pins.tees) : [],
      course.courseTees
    );
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
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Course summary */}
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="space-y-1">
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Holes
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {course.holeCount}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Greens
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {mappingProgress.mappedHoleCount}/{mappingHoleCount}
              </p>
            </div>
            <div className="col-span-2 rounded-lg border bg-muted/20 px-3 py-2.5 sm:col-span-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Tee boxes
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {mappingProgress.mappedTeeCount}/{mappingProgress.requiredTeeCount}
              </p>
            </div>
            <div className="col-span-2 rounded-lg border bg-muted/20 px-3 py-2.5 sm:col-span-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Tees
              </p>
              <p className="mt-1 truncate text-sm font-semibold">
                {sortedTees.map((tee) => tee.teeName).join(" · ")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <CourseHoleMappingPanel
        title="Hole mapping"
        description="Review greens, tee boxes, and fairway paths hole by hole."
        mappingHoleNumbers={mappingHoleNumbers}
        activeHole={activeHole}
        onActiveHoleChange={setActiveHole}
        isHoleComplete={isHoleMappingComplete}
        mappingHoleCount={mappingHoleCount}
        activeHolePar={activeHolePar}
        activeHoleYardage={activeHoleYardage}
        courseCenter={courseCenter}
        courseTees={course.courseTees}
        initialGreen={holePins[activeHole]?.green ?? null}
        initialTees={holePins[activeHole]?.tees ?? {}}
        initialLineBreaks={holePins[activeHole]?.lineBreaks ?? []}
        scorecardYardages={activeHoleScorecardYardages}
        readOnly
        mappingProgress={mappingProgress}
        showProgress
      />

      <CourseScorecardPreviewSection
        courseName={course.name}
        holeCount={course.holeCount}
        courseHoles={course.courseHoles}
        sortedTees={sortedTees}
        scorecardImageUrl={course.scorecardImageUrl}
        description="Par, handicap, and yardages submitted by the course."
        emptyImageMessage="No scorecard image uploaded."
      />

      {/* Approval actions */}
      <DashboardSectionCard
        icon={CheckCircle2}
        title="Decision"
        description="Approve to publish this course, or reject with notes for the course owner."
      >
        <div className="space-y-4 p-4 sm:p-5">
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
      </DashboardSectionCard>
    </div>
  );
}
