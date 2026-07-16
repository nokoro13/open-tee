import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminCourseReviewPanel } from "@/components/dashboard/admin-course-review-panel";
import { ButtonLink } from "@/components/ui/button-link";
import { getCourseForAdminReview } from "@/lib/course-onboarding-data";
import { requireUserId } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type AdminCourseReviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCourseReviewPage({
  params,
}: AdminCourseReviewPageProps) {
  const userId = await requireUserId();
  if (!isPlatformAdmin(userId)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseForAdminReview(id);

  if (!course || course.onboardingStatus !== "submitted") {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ButtonLink
        variant="ghost"
        size="sm"
        href="/dashboard/admin/courses"
        className="-ml-2 w-fit"
      >
        <ArrowLeft />
        Back to verification queue
      </ButtonLink>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {course.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review the submitted scorecard and hole mapping before publishing this
          course.
        </p>
      </div>

      <AdminCourseReviewPanel course={course} />
    </div>
  );
}
