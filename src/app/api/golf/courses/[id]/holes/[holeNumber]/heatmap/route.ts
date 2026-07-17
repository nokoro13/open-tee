import { NextResponse } from "next/server";

import { getGreenElevationGrid } from "@/lib/golf-courses";

type HeatmapRouteProps = {
  params: Promise<{ id: string; holeNumber: string }>;
};

export async function GET(_request: Request, { params }: HeatmapRouteProps) {
  const { id, holeNumber } = await params;
  const parsedHole = Number.parseInt(holeNumber, 10);

  if (!Number.isFinite(parsedHole) || parsedHole < 1 || parsedHole > 18) {
    return NextResponse.json({ error: "Invalid hole number." }, { status: 400 });
  }

  const grid = await getGreenElevationGrid(id, parsedHole);
  if (!grid) {
    return NextResponse.json({ error: "Heatmap not found." }, { status: 404 });
  }

  return NextResponse.json({
    hole: parsedHole,
    bounds: grid.boundsGeoJson,
    gridWidth: grid.gridWidth,
    gridHeight: grid.gridHeight,
    slope: grid.slopeData,
    elevation: grid.elevationData,
    resolutionM: grid.resolutionM,
    source: grid.source,
  });
}
