import { NextResponse } from "next/server";

import { getVerifiedCourseDetail } from "@/lib/course-onboarding";
import { getOpenGolfCourse } from "@/lib/opengolfapi";

type CourseRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: CourseRouteProps) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const teeKey = searchParams.get("teeKey");

  try {
    const verified = await getVerifiedCourseDetail(id);
    if (verified) {
      return NextResponse.json({ course: verified, source: "verified" });
    }

    const course = await getOpenGolfCourse(id, {
      teeKey: teeKey || undefined,
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    return NextResponse.json({ course, source: "opengolf" });
  } catch {
    return NextResponse.json(
      { error: "Could not load course." },
      { status: 502 }
    );
  }
}
