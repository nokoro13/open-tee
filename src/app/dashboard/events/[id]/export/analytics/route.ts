import { notFound } from "next/navigation";

import { getEventById } from "@/actions/events";
import { buildEventAnalyticsReport } from "@/lib/event-analytics";
import { requireOrganization } from "@/lib/auth";
import { canUseProFeature } from "@/lib/platform-tier";

type AnalyticsExportPageProps = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  { params }: AnalyticsExportPageProps
) {
  const { id } = await params;
  const org = await requireOrganization();
  const event = await getEventById(id);

  if (!event || event.orgId !== org.id) {
    notFound();
  }

  if (!canUseProFeature(event, "post_event_analytics")) {
    notFound();
  }

  const report = await buildEventAnalyticsReport(id, org.id);
  if (!report) {
    notFound();
  }

  const rows = [
    ["Metric", "Value"],
    ["Event", report.eventName],
    ["Date", report.eventDate],
    ["Format", report.format],
    ["Max players", String(report.maxPlayers)],
    ["Registrations", String(report.registrationCount)],
    ["Paid", String(report.paidCount)],
    ["Comped", String(report.compedCount)],
    ["Pending", String(report.pendingCount)],
    ["Refunded", String(report.refundedCount)],
    ["Capacity %", String(report.capacityPercent)],
    ["Entry fee revenue", (report.entryFeeRevenueCents / 100).toFixed(2)],
    ["Sponsor revenue", (report.sponsorRevenueCents / 100).toFixed(2)],
    ["Total revenue", (report.totalRevenueCents / 100).toFixed(2)],
    ["Average entry fee", (report.averageEntryFeeCents / 100).toFixed(2)],
    ["Scoring completion %", String(report.scoringCompletionPercent)],
    ["Scores entered", String(report.scoresEntered)],
    ["Waitlist size", String(report.waitlistSize)],
    ["Early bird registrations", String(report.earlyBirdRegistrations)],
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-analytics.csv"`,
    },
  });
}
