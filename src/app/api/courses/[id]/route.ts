import { NextResponse } from "next/server";

import { getVerifiedCourseDetail } from "@/lib/course-onboarding";

type CourseRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: CourseRouteProps) {
  const { id } = await params;

  try {
    const course = await getVerifiedCourseDetail(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    return NextResponse.json({ course, source: "verified" });
  } catch {
    return NextResponse.json(
      { error: "Could not load course." },
      { status: 502 }
    );
  }
}
