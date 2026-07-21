"use client";

import { PairingsBuilder } from "@/components/dashboard/pairings-builder";
import type { EventPairings } from "@/lib/pairings";
import type { StartFormat } from "@/lib/start-format";

type PairingsPanelProps = {
  eventId: string;
  slug: string;
  appUrl: string;
  scoringStatus: "disabled" | "open" | "finalized";
  startFormat: StartFormat;
  shotgunStartTime: string | null;
  firstTeeTime: string | null;
  teeTimeIntervalMinutes: number | null;
  holes: "9" | "18";
  format: string;
  teamAName?: string | null;
  teamBName?: string | null;
  pairings: EventPairings;
};

export function PairingsPanel(props: PairingsPanelProps) {
  return <PairingsBuilder {...props} />;
}
