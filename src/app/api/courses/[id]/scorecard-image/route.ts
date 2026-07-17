import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { uploadCourseScorecardImage } from "@/lib/course-scorecard-image-server";

type ScorecardImageRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: ScorecardImageRouteProps) {
  const { id: courseId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Upload a valid image file." },
      { status: 400 }
    );
  }

  const result = await uploadCourseScorecardImage(courseId, file);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidatePath(`/dashboard/courses/${courseId}/onboard`);
  return NextResponse.json({ url: result.url });
}
