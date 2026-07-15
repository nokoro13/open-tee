import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CourseOnboardingWizard } from "@/components/dashboard/course-onboarding-wizard";
import { ButtonLink } from "@/components/ui/button-link";
import { requireOrganization } from "@/lib/auth";
import {
  countCourseMappingProgress,
  getCourseOnboardingBundle,
  onboardingStepForCourse,
} from "@/lib/course-onboarding";

export const dynamic = "force-dynamic";

type CourseOnboardPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CourseOnboardPage({ params }: CourseOnboardPageProps) {
  const { id } = await params;
  const org = await requireOrganization();
  const course = await getCourseOnboardingBundle(id);

  if (!course || course.orgId !== org.id) {
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

      <CourseOnboardingWizard course={course} initialStep={initialStep} />
    </div>
  );
}
