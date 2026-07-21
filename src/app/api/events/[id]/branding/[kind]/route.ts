import { NextResponse } from "next/server";

import {
  uploadEventBrandingImage,
  type BrandingImageKind,
} from "@/lib/event-branding-image-server";

type RouteParams = {
  params: Promise<{ id: string; kind: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { id, kind } = await params;

  if (kind !== "logo" && kind !== "cover") {
    return NextResponse.json({ error: "Invalid image type." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  const result = await uploadEventBrandingImage(
    id,
    kind as BrandingImageKind,
    file
  );

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ url: result.url });
}
