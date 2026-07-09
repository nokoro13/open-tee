import { NextResponse } from "next/server";

import { getHoleTargets } from "@/lib/golf-courses";

type TargetsRouteProps = {
  params: Promise<{ id: string; holeNumber: string }>;
};

export async function GET(_request: Request, { params }: TargetsRouteProps) {
  const { id, holeNumber } = await params;
  const parsedHole = Number.parseInt(holeNumber, 10);

  if (!Number.isFinite(parsedHole) || parsedHole < 1 || parsedHole > 18) {
    return NextResponse.json({ error: "Invalid hole number." }, { status: 400 });
  }

  const targets = await getHoleTargets(id, parsedHole);
  if (!targets) {
    return NextResponse.json({ error: "Targets not found." }, { status: 404 });
  }

  return NextResponse.json({ hole: parsedHole, targets });
}
