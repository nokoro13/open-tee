import { NextResponse } from "next/server";

import { buildLeaderboard, getPublishedEventForScoring } from "@/lib/scoring";

type LeaderboardRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: LeaderboardRouteProps) {
  const { slug } = await params;
  const url = new URL(request.url);
  const scoreBasis =
    url.searchParams.get("basis") === "net" ? "net" : "gross";
  const flightId = url.searchParams.get("flight");

  const event = await getPublishedEventForScoring(slug);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.scoringStatus === "disabled") {
    return NextResponse.json({
      event: {
        name: event.name,
        slug: event.slug,
        format: event.format,
        holes: event.holes,
        scoringStatus: event.scoringStatus,
      },
      entries: [],
    });
  }

  const { entries, ryderCup } = await buildLeaderboard(
    event.id,
    event.format,
    event.holes,
    {
      scoreBasis,
      flightId,
    }
  );

  return NextResponse.json({
    event: {
      name: event.name,
      slug: event.slug,
      format: event.format,
      holes: event.holes,
      scoringStatus: event.scoringStatus,
      courseName: event.courseName,
    },
    entries,
    ryderCup,
    scoreBasis,
    flightId,
    updatedAt: new Date().toISOString(),
  });
}
