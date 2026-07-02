import { NextResponse } from "next/server";

import { searchOpenGolfCourses } from "@/lib/opengolfapi";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ courses: [] });
  }

  try {
    const courses = await searchOpenGolfCourses(q, 8);
    return NextResponse.json({ courses });
  } catch {
    return NextResponse.json(
      { error: "Course search unavailable." },
      { status: 502 }
    );
  }
}
