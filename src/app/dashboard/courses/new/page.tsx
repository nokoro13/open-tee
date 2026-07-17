import { ArrowLeft } from "lucide-react";

import { NewCourseOnboardingForm } from "@/components/dashboard/new-course-onboarding-form";
import { ButtonLink } from "@/components/ui/button-link";

export const dynamic = "force-dynamic";

export default function NewCourseOnboardingPage() {
  return (
    <div className="space-y-6">
      <ButtonLink
        variant="ghost"
        size="sm"
        href="/dashboard/courses"
        className="-ml-2 w-fit"
      >
        <ArrowLeft />
        Back to courses
      </ButtonLink>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Add a course
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Start verified onboarding with course details, then confirm the
          scorecard and map each hole.
        </p>
      </div>

      <NewCourseOnboardingForm />
    </div>
  );
}
