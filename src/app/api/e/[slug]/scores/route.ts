import { NextResponse } from "next/server";

import {
  buildEventScoresRecord,
  getPublishedEventForScoring,
  resolveScoringAccess,
} from "@/lib/scoring";

type ScoresRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: ScoresRouteProps) {
  const { slug } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code?.trim()) {
    return NextResponse.json({ error: "Scoring code required" }, { status: 400 });
  }

  const event = await getPublishedEventForScoring(slug);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.scoringStatus === "disabled") {
    return NextResponse.json({ error: "Scoring is not open" }, { status: 403 });
  }

  const access = await resolveScoringAccess(event.id, event, code);
  if (!access) {
    return NextResponse.json({ error: "Invalid scoring code" }, { status: 401 });
  }

  const scores = await buildEventScoresRecord(event.id, event.format);

  return NextResponse.json({
    scores,
    scoringStatus: event.scoringStatus,
    updatedAt: new Date().toISOString(),
  });
}
