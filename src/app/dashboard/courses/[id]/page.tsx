import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { CourseAccessPanel } from "@/components/dashboard/course-access-panel";
import { VerifiedCoursePreviewPanel } from "@/components/dashboard/verified-course-preview-panel";
import { ButtonLink } from "@/components/ui/button-link";
import { requireOrganization, requireUserId } from "@/lib/auth";
import {
  canUserEditCourse,
  getCourseAccessForCourse,
} from "@/lib/course-access";
import { getVerifiedCourseForPreview } from "@/lib/course-onboarding-data";
import { isPlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type VerifiedCoursePageProps = {
  params: Promise<{ id: string }>;
};

export default async function VerifiedCoursePage({ params }: VerifiedCoursePageProps) {
  const { id } = await params;
  const userId = await requireUserId();
  const org = await requireOrganization();
  const course = await getVerifiedCourseForPreview(id);

  if (!course) {
    notFound();
  }

  const canEdit = await canUserEditCourse({
    userId,
    orgId: org.id,
    courseId: course.id,
    courseOrgId: course.orgId,
  });

  const isAdmin = isPlatformAdmin(userId);
  const accessGrants = isAdmin ? await getCourseAccessForCourse(course.id) : [];

  return (
    <div className="space-y-4">
      <ButtonLink
        variant="ghost"
        size="sm"
        href="/dashboard/courses"
        className="-ml-2 w-fit"
      >
        <ArrowLeft />
        Back to courses
      </ButtonLink>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {course.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Verified course catalog — scorecard, yardages, and hole mapping.
          </p>
        </div>
        {canEdit && (
          <ButtonLink
            href={`/dashboard/courses/${course.id}/onboard`}
            className="h-11 w-full shrink-0 sm:h-9 sm:w-auto"
          >
            <Pencil />
            Edit course
          </ButtonLink>
        )}
      </div>

      {isAdmin && (
        <CourseAccessPanel courseId={course.id} grants={accessGrants} />
      )}

      <VerifiedCoursePreviewPanel course={course} />
    </div>
  );
}
