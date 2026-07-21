import { notFound } from "next/navigation";

import {
  buildLeaderboard,
  getPublishedEventForScoring,
} from "@/lib/scoring";
import { LeaderboardView } from "@/components/public/leaderboard-view";

type LeaderboardPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ basis?: string; flight?: string }>;
};

export default async function LeaderboardPage({
  params,
  searchParams,
}: LeaderboardPageProps) {
  const { slug } = await params;
  const { basis, flight } = await searchParams;
  const event = await getPublishedEventForScoring(slug);

  if (!event) {
    notFound();
  }

  const scoreBasis = basis === "net" ? "net" : "gross";
  const showNetToggle =
    event.format === "stroke" || event.format === "best_ball";

  const leaderboard =
    event.scoringStatus === "disabled"
      ? { entries: [] as Awaited<ReturnType<typeof buildLeaderboard>>["entries"] }
      : await buildLeaderboard(event.id, event.format, event.holes, {
          scoreBasis,
          flightId: flight ?? null,
        });

  const initialData = {
    event: {
      name: event.name,
      slug: event.slug,
      format: event.format,
      holes: event.holes,
      scoringStatus: event.scoringStatus,
      courseName: event.courseName,
    },
    entries: leaderboard.entries,
    ryderCup: leaderboard.ryderCup,
  };

  return (
    <LeaderboardView
      slug={slug}
      initialData={initialData}
      showNetToggle={showNetToggle}
    />
  );
}
