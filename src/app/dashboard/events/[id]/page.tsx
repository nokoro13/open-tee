import { notFound } from "next/navigation";

import { syncRegistrationWorkflow } from "@/actions/event-workflow";
import { getEventById, getEventByIdWithScorecard } from "@/actions/events";
import { syncPublishIfPaid } from "@/actions/publish";
import { syncCurrentOrganizationSubscription } from "@/actions/subscription";
import { EventWorkspaceActions } from "@/components/dashboard/event-workspace-actions";
import { EventWorkspaceHeader } from "@/components/dashboard/event-workspace-header";
import {
  EventDetailView,
  EventTabPanel,
} from "@/components/dashboard/event-detail-view";
import { EventForm } from "@/components/dashboard/event-form";
import { PairingsPanel } from "@/components/dashboard/pairings-panel";
import { PublishEventCard } from "@/components/dashboard/publish-event-card";
import { RegistrationsList } from "@/components/dashboard/registrations-list";
import { EventLifecycleCard } from "@/components/dashboard/event-lifecycle-card";
import { getFlightsForEvent } from "@/actions/flights";
import { getSponsorPackagesForDashboard } from "@/actions/sponsors";
import { getWaitlistForEvent } from "@/actions/waitlist";
import { EventAnalyticsReportCard } from "@/components/dashboard/event-analytics-report";
import { EventBrandingPanel } from "@/components/dashboard/event-branding-panel";
import { FlightsPanel } from "@/components/dashboard/flights-panel";
import { ProFeaturesPanel } from "@/components/dashboard/pro-features-panel";
import { SponsorPackagesPanel } from "@/components/dashboard/sponsor-packages-panel";
import { PayoutInfoCard } from "@/components/dashboard/payout-info-card";
import { StartFormatCard } from "@/components/dashboard/start-format-card";
import { DeleteEventButton } from "@/components/dashboard/delete-event-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatEventHeaderDate,
  getCurrentSetupStep,
  parseEventTab,
} from "@/lib/event-dashboard";
import {
  getRegistrationsForEvent,
  getRegistrationCount,
} from "@/lib/events";
import { buildEventAnalyticsReport } from "@/lib/event-analytics";
import { buildEventWorkflowSnapshot } from "@/lib/event-workflow";
import { isOrgSubscriptionActive } from "@/lib/subscription";
import { getAppUrl } from "@/lib/stripe";
import { syncEventScoringCodes } from "@/actions/scoring";
import { getGroupScoringProgress } from "@/lib/scoring";
import { syncTeeTimesForEvent } from "@/actions/start-format";
import { getEventPairings } from "@/lib/pairings";
import { requireOrganization } from "@/lib/auth";
import { getEventFormatLabel } from "@/lib/event-formats";
import {
  eventWorkspaceSettingsStackClassName,
  eventWorkspaceSettingsSurfaceClassName,
} from "@/lib/event-workspace-layout";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    published?: string;
    publish_canceled?: string;
    subscribed?: string;
    subscribe_canceled?: string;
    tab?: string;
  }>;
};

export default async function EventDetailPage({
  params,
  searchParams,
}: EventDetailPageProps) {
  const { id } = await params;
  const { published, publish_canceled, subscribed, subscribe_canceled, tab } =
    await searchParams;
  let org = await requireOrganization();
  if (subscribed === "1") {
    org = await syncCurrentOrganizationSubscription();
  }
  let event = await getEventById(id);

  if (!event) {
    notFound();
  }

  const eventWithScorecard = await getEventByIdWithScorecard(id);

  if (published === "1" && event.status === "draft") {
    event = (await syncPublishIfPaid(id)) ?? event;
  }

  const isDraft = event.status === "draft";
  const isOperationalEvent = !isDraft;
  const activeTab = parseEventTab(tab, isDraft);
  const registrationUrl = `${getAppUrl()}/e/${event.slug}`;

  const [
    registrationCount,
    registrations,
    pairings,
    flights,
    sponsorData,
    waitlist,
    analyticsReport,
  ] = isOperationalEvent
    ? await Promise.all([
        getRegistrationCount(event.id),
        getRegistrationsForEvent(event.id, org.id),
        (async () => {
          if (event.scoringStatus !== "finalized") {
            await syncEventScoringCodes(event.id);
          }
          if (event.startFormat === "tee_times") {
            await syncTeeTimesForEvent(event.id);
          }
          return getEventPairings(event.id, org.id);
        })(),
        getFlightsForEvent(event.id, org.id),
        getSponsorPackagesForDashboard(event.id, org.id),
        event.waitlistEnabled
          ? getWaitlistForEvent(event.id, org.id)
          : Promise.resolve([]),
        buildEventAnalyticsReport(event.id, org.id),
      ])
    : [0, [], null, [], { packages: [], purchases: [] }, [], null];

  if (isOperationalEvent) {
    await syncRegistrationWorkflow(event.id);
    event = (await getEventById(id)) ?? event;
  }

  const workflow = isOperationalEvent
    ? buildEventWorkflowSnapshot({
        event,
        eventId: event.id,
        format: event.format,
        teamSize: event.teamSize,
        registrationCount,
        pairings,
      })
    : null;

  const nextStep = getCurrentSetupStep({
    eventId: event.id,
    isDraft,
    registrationCount,
    pairings,
    scoringStatus: event.scoringStatus,
  });

  const groupScoringProgress =
    isOperationalEvent && event.scoringStatus !== "disabled"
      ? await getGroupScoringProgress(event.id, event.format, event.holes)
      : null;
  const canPrintScorecards =
    pairings?.groups.some(
      (group) => group.players.length > 0 && group.scoringCode != null
    ) ?? false;

  const workspaceActions = (
    <EventWorkspaceActions
      event={event}
      canPrintScorecards={canPrintScorecards}
      printScorecardsHref={`/print/events/${event.id}/scorecards`}
      workflow={workflow}
      groupScoringProgress={groupScoringProgress}
      nextStep={nextStep}
      isDraft={isDraft}
    />
  );

  return (
    <EventDetailView
      initialTab={activeTab}
      isDraft={isDraft}
      event={{
        id: event.id,
        name: event.name,
        slug: event.slug,
        status: event.status,
        scoringStatus: event.scoringStatus,
        courseName: event.courseName,
        date: event.date,
      }}
      header={
        <EventWorkspaceHeader isDraft={isDraft} actions={workspaceActions} />
      }
    >
      {published === "1" && (
        <p className="mb-4 text-sm text-primary">
          Payment received — your event is live.
        </p>
      )}

      {publish_canceled === "1" && (
        <p className="mb-4 text-sm text-muted-foreground">
          Publish checkout was canceled. Your event remains in draft.
        </p>
      )}

      {isDraft && (
        <>
          <EventTabPanel tab="details">
            <Card>
              <CardContent className="pt-(--card-spacing)">
                <EventForm event={eventWithScorecard ?? undefined} />
              </CardContent>
            </Card>
          </EventTabPanel>

          <EventTabPanel tab="publish">
            <PublishEventCard
              eventId={event.id}
              eventName={event.name}
              eventStatus={event.status}
              hasActiveSubscription={isOrgSubscriptionActive(org)}
              subscribed={subscribed === "1"}
              subscribeCanceled={subscribe_canceled === "1"}
            />
          </EventTabPanel>
        </>
      )}

      {isOperationalEvent && (
        <>
          <EventTabPanel tab="players">
            <RegistrationsList
              eventId={event.id}
              registrations={registrations}
              registrationCount={registrationCount}
              maxPlayers={event.maxPlayers}
              registrationUrl={registrationUrl}
              previewHref={`/e/${event.slug}`}
              scoringStatus={event.scoringStatus}
              eventStatus={event.status}
            />
          </EventTabPanel>

          {pairings && (
            <EventTabPanel tab="pairings">
              <div className="space-y-4">
                <StartFormatCard
                  eventId={event.id}
                  scoringStatus={event.scoringStatus}
                  event={{
                    startFormat: event.startFormat,
                    shotgunStartTime: event.shotgunStartTime,
                    firstTeeTime: event.firstTeeTime,
                    teeTimeIntervalMinutes: event.teeTimeIntervalMinutes,
                  }}
                />
                <PairingsPanel
                  eventId={event.id}
                  slug={event.slug}
                  appUrl={getAppUrl()}
                  scoringStatus={event.scoringStatus}
                  startFormat={event.startFormat}
                  shotgunStartTime={event.shotgunStartTime}
                  firstTeeTime={event.firstTeeTime}
                  teeTimeIntervalMinutes={event.teeTimeIntervalMinutes}
                  holes={event.holes}
                  format={event.format}
                  teamSize={event.teamSize}
                  teamAName={event.teamAName}
                  teamBName={event.teamBName}
                  pairings={pairings}
                />
              </div>
            </EventTabPanel>
          )}

          <EventTabPanel tab="analytics">
            {analyticsReport ? (
              <EventAnalyticsReportCard
                eventId={event.id}
                report={analyticsReport}
              />
            ) : (
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Analytics</CardTitle>
                  <CardDescription>
                    Analytics appear once players register.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </EventTabPanel>

          <EventTabPanel tab="settings">
            <div className={eventWorkspaceSettingsStackClassName}>
              <ProFeaturesPanel event={event} />
              <EventBrandingPanel event={event} />
              <FlightsPanel eventId={event.id} flights={flights} />
              <SponsorPackagesPanel
                eventId={event.id}
                packages={sponsorData.packages}
                purchases={sponsorData.purchases}
              />
              {event.waitlistEnabled && waitlist.length > 0 && (
                <Card className={eventWorkspaceSettingsSurfaceClassName}>
                  <CardHeader>
                    <CardTitle>Waitlist</CardTitle>
                    <CardDescription>
                      {waitlist.length} waiting for a spot.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y text-sm">
                      {waitlist.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{entry.name}</p>
                            <p className="truncate text-muted-foreground">
                              {entry.email}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {entry.notifiedAt ? "Notified" : "Waiting"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <EventLifecycleCard event={event} />
              <PayoutInfoCard />

              <Card className={eventWorkspaceSettingsSurfaceClassName}>
                <CardHeader>
                  <CardTitle>Event details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: "Course", value: event.courseName },
                      {
                        label: "Date",
                        value: formatEventHeaderDate(event.date),
                      },
                      {
                        label: "Format",
                        value: `${getEventFormatLabel(event.format)} · ${event.holes} holes`,
                      },
                      {
                        label: "Entry fee",
                        value:
                          event.entryFeeCents === 0
                            ? "Free"
                            : `$${(event.entryFeeCents / 100).toFixed(2)}`,
                      },
                      {
                        label: "Capacity",
                        value: `${event.maxPlayers} players`,
                      },
                    ].map((row) => (
                      <div key={row.label}>
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className="font-medium">{row.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <h3 className="text-sm font-medium">Danger zone</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Permanently delete this event and all associated data.
                    </p>
                    <div className="mt-3">
                      <DeleteEventButton
                        eventId={event.id}
                        eventName={event.name}
                        status={event.status}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </EventTabPanel>
        </>
      )}
    </EventDetailView>
  );
}
