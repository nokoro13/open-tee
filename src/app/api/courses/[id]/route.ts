import { NextResponse } from "next/server";

import { getOpenGolfCourse } from "@/lib/opengolfapi";

type CourseRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: CourseRouteProps) {
  const { id } = await params;

  try {
    const course = await getOpenGolfCourse(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch {
    return NextResponse.json(
      { error: "Could not load course." },
      { status: 502 }
    );
  }
}
