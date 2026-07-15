import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { getOnboardingCoursesForOrg } from "@/lib/course-onboarding-data";
import { ButtonLink } from "@/components/ui/button-link";
import { requireOrganization } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export default async function CoursesPage() {
  const org = await requireOrganization();
  const courses = await getOnboardingCoursesForOrg(org.id);

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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Verified courses
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Onboard golf courses with verified scorecards and hole maps. These
            become your authoritative course dataset for events and Caddie Mode.
          </p>
        </div>
        <ButtonLink href="/dashboard/courses/new">
          <Plus />
          Add course
        </ButtonLink>
      </div>

      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No courses yet. Add your first course to start the onboarding
          workflow with a scorecard photo, confirmed hole data, and tee/green
          mapping.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/dashboard/courses/${course.id}/onboard`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium">{course.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[course.city, course.state].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{course.holeCount} holes</Badge>
                  <Badge variant="outline">{course.mappedHoleCount} mapped</Badge>
                  <Badge
                    variant={
                      course.onboardingStatus === "verified"
                        ? "default"
                        : "secondary"
                    }
                    className="capitalize"
                  >
                    {course.onboardingStatus}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
