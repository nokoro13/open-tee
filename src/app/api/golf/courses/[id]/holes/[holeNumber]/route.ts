import { NextResponse } from "next/server";

import { getEnrichedHoleFeatureCollection, getHoleFeatureCollection } from "@/lib/golf-courses";

type HoleRouteProps = {
  params: Promise<{ id: string; holeNumber: string }>;
};

export async function GET(request: Request, { params }: HoleRouteProps) {
  const { id, holeNumber } = await params;
  const parsedHole = Number.parseInt(holeNumber, 10);
  const enrich = new URL(request.url).searchParams.get("enrich") === "1";

  if (!Number.isFinite(parsedHole) || parsedHole < 1 || parsedHole > 18) {
    return NextResponse.json({ error: "Invalid hole number." }, { status: 400 });
  }

  const features = enrich
    ? await getEnrichedHoleFeatureCollection(id, parsedHole)
    : await getHoleFeatureCollection(id, parsedHole);
  return NextResponse.json({ hole: parsedHole, features });
}
