import Link from "next/link";
import { ArrowLeft, Eye, Pencil, Plus } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { requireOrganization, requireUserId } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { formatCourseLocationLine } from "@/lib/course-location";
import {
  canUserEditCourse,
} from "@/lib/course-access";
import {
  getEditableInProgressCourses,
  getVerifiedCoursesCatalog,
} from "@/lib/course-onboarding-data";

export default async function CoursesPage() {
  const userId = await requireUserId();
  const org = await requireOrganization();
  const [verifiedCourses, inProgressCourses] = await Promise.all([
    getVerifiedCoursesCatalog(),
    getEditableInProgressCourses(userId, org.id),
  ]);

  const verifiedWithAccess = await Promise.all(
    verifiedCourses.map(async (course) => ({
      course,
      canEdit: await canUserEditCourse({
        userId,
        orgId: org.id,
        courseId: course.id,
        courseOrgId: course.orgId,
      }),
    }))
  );

  return (
    <div className="space-y-8">
      <ButtonLink
        variant="ghost"
        size="sm"
        href="/dashboard"
        className="-ml-2 w-fit"
      >
        <ArrowLeft />
        Back to dashboard
      </ButtonLink>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Verified courses
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Browse the full verified course catalog for events and Caddie Mode.
          </p>
        </div>
        <ButtonLink href="/dashboard/courses/new">
          <Plus />
          Add course
        </ButtonLink>
      </div>

      {inProgressCourses.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Courses in progress</h2>
            <p className="text-sm text-muted-foreground">
              Draft and onboarding courses you can edit.
            </p>
          </div>
          <ul className="divide-y rounded-lg border">
            {inProgressCourses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/dashboard/courses/${course.id}/onboard`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{course.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCourseLocationLine({
                        city: course.city,
                        state: course.state,
                        country: course.country,
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {course.accessType === "granted" && (
                      <Badge variant="outline">Shared access</Badge>
                    )}
                    <Badge variant="outline">{course.holeCount} holes</Badge>
                    <Badge variant="secondary" className="capitalize">
                      {course.onboardingStatus}
                    </Badge>
                    <Badge variant="outline">
                      <Pencil className="size-3" />
                      Edit
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Verified catalog</h2>
          <p className="text-sm text-muted-foreground">
            All published verified courses available for your events.
          </p>
        </div>

        {verifiedWithAccess.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No verified courses have been published yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {verifiedWithAccess.map(({ course, canEdit }) => (
              <li key={course.id}>
                <Link
                  href={`/dashboard/courses/${course.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{course.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCourseLocationLine({
                        city: course.city,
                        state: course.state,
                        country: course.country,
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">Verified</Badge>
                    <Badge variant="outline">{course.holeCount} holes</Badge>
                    <Badge variant="outline">{course.mappedHoleCount} mapped</Badge>
                    {canEdit ? (
                      <Badge variant="outline">
                        <Pencil className="size-3" />
                        Can edit
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Eye className="size-3" />
                        Preview
                      </Badge>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
