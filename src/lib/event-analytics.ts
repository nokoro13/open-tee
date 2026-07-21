import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  events,
  holeScores,
  registrations,
  sponsorPurchases,
} from "@/db/schema";
import { getRegistrationCount } from "@/lib/events";
import { getActiveEntryFee } from "@/lib/event-pricing";

export type EventAnalyticsReport = {
  eventId: string;
  eventName: string;
  eventDate: string;
  format: string;
  maxPlayers: number;
  registrationCount: number;
  paidCount: number;
  compedCount: number;
  pendingCount: number;
  refundedCount: number;
  capacityPercent: number;
  entryFeeRevenueCents: number;
  sponsorRevenueCents: number;
  totalRevenueCents: number;
  averageEntryFeeCents: number;
  scoringCompletionPercent: number;
  holesExpected: number;
  scoresEntered: number;
  earlyBirdRegistrations: number;
  waitlistSize: number;
};

export async function buildEventAnalyticsReport(
  eventId: string,
  orgId: string
): Promise<EventAnalyticsReport | null> {
  const event = await getDb().query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.orgId, orgId)),
    with: {
      waitlistEntries: true,
    },
  });

  if (!event) return null;

  const registrationRows = await getDb().query.registrations.findMany({
    where: eq(registrations.eventId, eventId),
  });

  const paid = registrationRows.filter((r) => r.paymentStatus === "paid");
  const comped = registrationRows.filter((r) => r.paymentStatus === "comped");
  const pending = registrationRows.filter((r) => r.paymentStatus === "pending");
  const refunded = registrationRows.filter((r) => r.paymentStatus === "refunded");

  const entryFeeRevenueCents = paid.reduce(
    (sum, row) => sum + (row.entryFeePaidCents ?? event.entryFeeCents),
    0
  );

  const sponsorRows = await getDb().query.sponsorPurchases.findMany({
    where: and(
      eq(sponsorPurchases.eventId, eventId),
      inArray(sponsorPurchases.paymentStatus, ["paid"])
    ),
  });

  const sponsorRevenueCents = sponsorRows.reduce(
    (sum, row) => sum + row.amountCents,
    0
  );

  const registrationCount = await getRegistrationCount(eventId);
  const capacityPercent =
    event.maxPlayers > 0
      ? Math.round((registrationCount / event.maxPlayers) * 100)
      : 0;

  const holeCount = event.holes === "18" ? 18 : 9;
  const activePlayers = registrationRows.filter(
    (r) => r.paymentStatus !== "refunded"
  );
  const holesExpected = activePlayers.length * holeCount;

  const [scoreCountRow] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(holeScores)
    .where(eq(holeScores.eventId, eventId));

  const scoresEntered = scoreCountRow?.count ?? 0;
  const scoringCompletionPercent =
    holesExpected > 0
      ? Math.min(100, Math.round((scoresEntered / holesExpected) * 100))
      : 0;

  const activePricing = getActiveEntryFee(event);
  const earlyBirdRegistrations = paid.filter(
    (row) =>
      row.entryFeePaidCents != null &&
      row.entryFeePaidCents < event.entryFeeCents &&
      row.entryFeePaidCents === activePricing.feeCents
  ).length;

  const averageEntryFeeCents =
    paid.length > 0 ? Math.round(entryFeeRevenueCents / paid.length) : 0;

  return {
    eventId: event.id,
    eventName: event.name,
    eventDate: event.date,
    format: event.format,
    maxPlayers: event.maxPlayers,
    registrationCount,
    paidCount: paid.length,
    compedCount: comped.length,
    pendingCount: pending.length,
    refundedCount: refunded.length,
    capacityPercent,
    entryFeeRevenueCents,
    sponsorRevenueCents,
    totalRevenueCents: entryFeeRevenueCents + sponsorRevenueCents,
    averageEntryFeeCents,
    scoringCompletionPercent,
    holesExpected,
    scoresEntered,
    earlyBirdRegistrations,
    waitlistSize: event.waitlistEntries.length,
  };
}

export function formatAnalyticsCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
