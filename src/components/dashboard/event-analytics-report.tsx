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
    <div className="min-w-0 rounded-2xl border border-border/70 bg-muted/20 p-3.5 sm:bg-card sm:p-4">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p className="mt-1.5 font-heading text-xl font-semibold tracking-tight sm:mt-2 sm:text-2xl">
        {value}
      </p>
      {caption && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">
          {caption}
        </p>
      )}
    </div>
  );
}

export function EventAnalyticsReportCard({
  eventId,
  report,
}: EventAnalyticsReportProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle>Post-event analytics</CardTitle>
            <CardDescription className="text-pretty">
              Registration, revenue, and scoring completion for {report.eventName}.
            </CardDescription>
          </div>
          <ButtonLink
            variant="outline"
            size="sm"
            href={`/dashboard/events/${eventId}/export/analytics`}
            className="h-10 w-full shrink-0 sm:h-8 sm:w-auto"
          >
            Download CSV
          </ButtonLink>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
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

          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
