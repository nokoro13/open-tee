import {
  formatAnalyticsCurrency,
  type EventAnalyticsReport,
} from "@/lib/event-analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";

type EventAnalyticsReportProps = {
  eventId: string;
  report: EventAnalyticsReport;
};

function StatBlock({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-heading text-2xl font-semibold">{value}</p>
      {caption && (
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}

export function EventAnalyticsReportCard({
  eventId,
  report,
}: EventAnalyticsReportProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Post-event analytics</CardTitle>
          <CardDescription>
            Registration, revenue, and scoring completion for {report.eventName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatBlock
              label="Registrations"
              value={`${report.registrationCount}`}
              caption={`${report.capacityPercent}% of ${report.maxPlayers} capacity`}
            />
            <StatBlock
              label="Entry fee revenue"
              value={formatAnalyticsCurrency(report.entryFeeRevenueCents)}
              caption={`${report.paidCount} paid · avg ${formatAnalyticsCurrency(report.averageEntryFeeCents)}`}
            />
            <StatBlock
              label="Sponsor revenue"
              value={formatAnalyticsCurrency(report.sponsorRevenueCents)}
            />
            <StatBlock
              label="Total revenue"
              value={formatAnalyticsCurrency(report.totalRevenueCents)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatBlock
              label="Paid"
              value={`${report.paidCount}`}
            />
            <StatBlock
              label="Comped"
              value={`${report.compedCount}`}
            />
            <StatBlock
              label="Scoring complete"
              value={`${report.scoringCompletionPercent}%`}
              caption={`${report.scoresEntered} scores entered`}
            />
            <StatBlock
              label="Waitlist"
              value={`${report.waitlistSize}`}
            />
          </div>

          <ButtonLink
            variant="outline"
            href={`/dashboard/events/${eventId}/export/analytics`}
          >
            Download analytics CSV
          </ButtonLink>
        </CardContent>
      </Card>
    </div>
  );
}
