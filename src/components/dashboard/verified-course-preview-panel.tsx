"use client";

import { useMemo, useState } from "react";

import { CourseHoleMappingPanel } from "@/components/dashboard/course-hole-mapping-panel";
import { CourseScorecardPreviewSection } from "@/components/dashboard/course-scorecard-preview-section";
import { Badge } from "@/components/ui/badge";
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
import { isHoleMappingCompleteForTees, sortCourseTees } from "@/lib/course-tees";
import { formatCourseLocationLine } from "@/lib/course-location";
import { parseCoordinate, holeNumbersForMapping } from "@/lib/green-distance";

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

  const sortedTees = useMemo(
    () => sortCourseTees(course.courseTees),
    [course.courseTees]
  );
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

  function isHoleMappingComplete(holeNumber: number) {
    const pins = holePins[holeNumber];
    return isHoleMappingCompleteForTees(
      mappedHoleNumbers.has(holeNumber),
      pins ? Object.keys(pins.tees) : [],
      course.courseTees
    );
  }

  const activeHoleData = course.courseHoles.find(
    (entry) => entry.holeNumber === activeHole
  );
  const activeHolePar = activeHoleData?.par;
  const activeHoleYardage =
    activeHoleScorecardYardages[sortedTees[0]?.teeKey ?? ""] ??
    activeHoleData?.yardage;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Course summary */}
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="space-y-1">
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <div className="mt-1">
                <Badge variant="default">Verified</Badge>
              </div>
            </div>
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
                Mapped
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {mappingProgress.mappedHoleCount}/{mappingHoleCount}
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
      />

      <CourseScorecardPreviewSection
        courseName={course.name}
        holeCount={course.holeCount}
        courseHoles={course.courseHoles}
        sortedTees={sortedTees}
        scorecardImageUrl={course.scorecardImageUrl}
      />
    </div>
  );
}
