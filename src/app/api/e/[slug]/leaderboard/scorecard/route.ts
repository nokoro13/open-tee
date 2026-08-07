import { NextResponse } from "next/server";

import { getLeaderboardEntryScorecard } from "@/lib/leaderboard-scorecard";
import { getPublishedEventForScoring } from "@/lib/scoring";

type ScorecardRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: ScorecardRouteProps) {
  const { slug } = await params;
  const entryId = new URL(request.url).searchParams.get("entryId");

  if (!entryId) {
    return NextResponse.json({ error: "entryId is required" }, { status: 400 });
  }

  const event = await getPublishedEventForScoring(slug);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.scoringStatus === "disabled") {
    return NextResponse.json({ error: "Scoring is disabled" }, { status: 404 });
  }

  const scorecard = await getLeaderboardEntryScorecard(
    event.id,
    entryId,
    event.format,
    event.holes
  );

  if (!scorecard) {
    return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });
  }

  return NextResponse.json({ scorecard });
}
