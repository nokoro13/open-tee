import { LandingPage } from "@/components/landing/landing-page";
import {
  getLandingPageStats,
  landingStatsToDisplay,
} from "@/lib/landing-stats";

export default async function Home() {
  const stats = landingStatsToDisplay(await getLandingPageStats());

  return <LandingPage stats={stats} />;
}
