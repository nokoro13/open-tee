import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CourseAccessPanel } from "@/components/dashboard/course-access-panel";
import { CourseOnboardingWizard } from "@/components/dashboard/course-onboarding-wizard";
import { ButtonLink } from "@/components/ui/button-link";
import { requireOrganization, requireUserId } from "@/lib/auth";
import {
  canUserEditCourse,
  canUserEditVerifiedCourse,
  getCourseAccessForCourse,
} from "@/lib/course-access";
import {
  countCourseMappingProgress,
  getCourseOnboardingBundle,
  onboardingStepForCourse,
} from "@/lib/course-onboarding";
import { getVerifiedCourseForPreview } from "@/lib/course-onboarding-data";
import { isPlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type CourseOnboardPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CourseOnboardPage({ params }: CourseOnboardPageProps) {
  const { id } = await params;
  const userId = await requireUserId();
  const org = await requireOrganization();
  const course = await getCourseOnboardingBundle(id);

  if (!course) {
    notFound();
  }

  const canAccess = await canUserEditCourse({
    userId,
    orgId: org.id,
    courseId: course.id,
    courseOrgId: course.orgId,
  });

  if (!canAccess) {
    const verifiedPreview = await getVerifiedCourseForPreview(id);
    if (verifiedPreview) {
      redirect(`/dashboard/courses/${id}`);
    }
    notFound();
  }

  const mappingProgress = countCourseMappingProgress(
    course,
    course.courseTees,
    course.greenTargets,
    course.holeFeatures
  );

  const initialStep = onboardingStepForCourse(
    course,
    course.courseHoles,
    course.courseTees,
    mappingProgress
  );

  const isAdmin = isPlatformAdmin(userId);
  const canEditVerifiedCourse =
    isAdmin ||
    (await canUserEditVerifiedCourse(userId, course.id, {
      courseOrgId: course.orgId,
      orgId: org.id,
    }));
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

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {course.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Verified course onboarding — scorecard, hole mapping, and platform
          review.
        </p>
      </div>

      {isAdmin && (
        <CourseAccessPanel courseId={course.id} grants={accessGrants} />
      )}

      <CourseOnboardingWizard
        course={course}
        initialStep={initialStep}
        canEditVerifiedCourse={canEditVerifiedCourse}
      />
    </div>
  );
}
