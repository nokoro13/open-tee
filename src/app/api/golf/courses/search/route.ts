import { NextResponse } from "next/server";

import { searchVerifiedCourses } from "@/lib/course-onboarding";
import { searchGolfCourses } from "@/lib/golf-courses";
import { parseCoordinate } from "@/lib/green-distance";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ courses: [] });
  }

  const verifiedCourses = await searchVerifiedCourses(query, 8);
  const verifiedResults = verifiedCourses.map((course) => ({
    id: course.externalCourseId ?? course.id,
    externalCourseId: course.externalCourseId,
    name: course.name,
    city: course.city,
    state: course.state,
    country: course.country,
    latitude: parseCoordinate(course.latitude),
    longitude: parseCoordinate(course.longitude),
    dataQuality: course.dataQuality,
    status: course.status,
    source: "verified" as const,
  }));

  const localCourses = await searchGolfCourses(query, 8);
  const localResults = localCourses.map((course) => ({
    id: course.id,
    externalCourseId: course.externalCourseId,
    name: course.name,
    city: course.city,
    state: course.state,
    country: course.country,
    latitude: parseCoordinate(course.latitude),
    longitude: parseCoordinate(course.longitude),
    dataQuality: course.dataQuality,
    status: course.status,
    source: "opentee" as const,
  }));

  const seen = new Set(
    [...verifiedResults, ...localResults]
      .map((course) => course.externalCourseId)
      .filter(Boolean)
  );

  const merged = [
    ...verifiedResults,
    ...localResults.filter(
      (course) => course.externalCourseId && !seen.has(course.externalCourseId)
    ),
  ];

  return NextResponse.json({ courses: merged });
}
