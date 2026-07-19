"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  rejectSubmittedCourse,
  verifySubmittedCourse,
} from "@/actions/course-onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import type { CourseHole, CourseTee, GolfCourse, Organization } from "@/db/schema";
import { formatCourseLocationLine } from "@/lib/course-location";

type AdminCourseVerificationListProps = {
  courses: (GolfCourse & {
    courseHoles: CourseHole[];
    courseTees: CourseTee[];
    organization: Organization | null;
  })[];
};

export function AdminCourseVerificationList({
  courses,
}: AdminCourseVerificationListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) return;
      router.refresh();
    });
  }

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No courses are waiting for verification.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {courses.map((course) => (
        <li key={course.id} className="space-y-3 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{course.name}</p>
              <p className="text-sm text-muted-foreground">
                {course.organization?.name ?? "Unknown organization"}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatCourseLocationLine({
                  city: course.city,
                  state: course.state,
                  country: course.country,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{course.holeCount} holes</Badge>
              <Badge variant="outline">{course.mappedHoleCount} mapped</Badge>
              {course.courseTees.length > 0 && (
                <Badge variant="outline">
                  {course.courseTees.map((tee) => tee.teeName).join(", ")}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/dashboard/admin/courses/${course.id}`} size="sm">
                Review course
              </ButtonLink>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => runAction(() => verifySubmittedCourse(course.id))}
              >
                Quick approve
              </Button>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/30 p-3 sm:flex-row sm:items-center">
              <Input
                className="bg-background sm:flex-1"
                placeholder="Rejection notes for the course owner"
                id={`reject-${course.id}`}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 sm:w-auto"
                disabled={isPending}
                onClick={() => {
                  const input = document.getElementById(
                    `reject-${course.id}`
                  ) as HTMLInputElement | null;
                  runAction(() =>
                    rejectSubmittedCourse(course.id, input?.value ?? "")
                  );
                }}
              >
                Reject course
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
