import { NextResponse } from "next/server";

import { getGolfCourseWithDetails } from "@/lib/golf-courses";
import { parseCoordinate } from "@/lib/green-distance";

type CourseRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: CourseRouteProps) {
  const { id } = await params;
  const course = await getGolfCourseWithDetails(id);

  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const holes = Array.from(
    new Set(course.holeFeatures.map((feature) => feature.holeNumber))
  ).sort((a, b) => a - b);

  return NextResponse.json({
    course: {
      id: course.id,
      externalCourseId: course.externalCourseId,
      name: course.name,
      city: course.city,
      state: course.state,
      latitude: parseCoordinate(course.latitude),
      longitude: parseCoordinate(course.longitude),
      status: course.status,
      dataQuality: course.dataQuality,
      mappedHoleCount: course.mappedHoleCount,
      publishedAt: course.publishedAt,
      holes: holes.map((holeNumber) => {
        const features = course.holeFeatures.filter(
          (feature) => feature.holeNumber === holeNumber
        );
        const targets = course.greenTargets.filter(
          (target) => target.holeNumber === holeNumber
        );
        const hasHeatmap = course.greenElevationGrids.some(
          (grid) => grid.holeNumber === holeNumber
        );

        return {
          holeNumber,
          featureTypes: features.map((feature) => feature.featureType),
          hasTargets: targets.length >= 3,
          hasHeatmap,
        };
      }),
    },
  });
}
