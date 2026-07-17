import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getSubmittedCoursesForAdmin } from "@/lib/course-onboarding-data";
import { AdminCourseVerificationList } from "@/components/dashboard/admin-course-verification-list";
import { ButtonLink } from "@/components/ui/button-link";
import { requireUserId } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const userId = await requireUserId();
  if (!isPlatformAdmin(userId)) {
    redirect("/dashboard");
  }

  const courses = await getSubmittedCoursesForAdmin();

  return (
    <div className="space-y-6">
      <ButtonLink
        variant="ghost"
        size="sm"
        href="/dashboard"
        className="-ml-2 w-fit"
      >
        <ArrowLeft />
        Back to dashboard
      </ButtonLink>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Course verification
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review submitted courses before publishing them for all events and
          Caddie Mode.
        </p>
      </div>

      <AdminCourseVerificationList courses={courses} />
    </div>
  );
}
