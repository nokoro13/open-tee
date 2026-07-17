import { NextResponse } from "next/server";

import { searchVerifiedCourses } from "@/lib/course-onboarding";
import { parseCoordinate } from "@/lib/green-distance";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ courses: [] });
  }

  try {
    const verified = await searchVerifiedCourses(q, 12);
    const courses = verified.map((course) => ({
      id: course.externalCourseId ?? course.id,
      name: course.name,
      course_name: course.name,
      city: course.city,
      state: course.state,
      country: course.country,
      latitude: parseCoordinate(course.latitude),
      longitude: parseCoordinate(course.longitude),
      par: course.courseHoles.reduce((sum, hole) => sum + hole.par, 0),
      source: "verified" as const,
    }));

    return NextResponse.json({ courses });
  } catch {
    return NextResponse.json(
      { error: "Course search unavailable." },
      { status: 502 }
    );
  }
}
