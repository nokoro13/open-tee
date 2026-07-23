import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  Trophy,
  Users,
} from "lucide-react";

import { syncRegistrationWorkflow } from "@/actions/event-workflow";
import { getEventById, getEventByIdWithScorecard } from "@/actions/events";
import { syncPublishIfPaid } from "@/actions/publish";
import { syncCurrentOrganizationSubscription } from "@/actions/subscription";
import { CopyRegistrationLink } from "@/components/dashboard/copy-registration-link";
import { EventDetailNextStep } from "@/components/dashboard/event-detail-next-step";
import {
  EventDetailView,
  EventTabPanel,
} from "@/components/dashboard/event-detail-view";
import { EventForm } from "@/components/dashboard/event-form";
import { PairingsPanel } from "@/components/dashboard/pairings-panel";
import { PublishEventCard } from "@/components/dashboard/publish-event-card";
import { RegistrationsList } from "@/components/dashboard/registrations-list";
import { RegistrationWindowFields } from "@/components/dashboard/registration-window-fields";
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
import { ScoringCard } from "@/components/dashboard/scoring-card";
import { StartFormatCard } from "@/components/dashboard/start-format-card";
import { DeleteEventButton } from "@/components/dashboard/delete-event-button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDaysUntilEvent,
  formatEventHeaderDate,
  getCurrentSetupStep,
  getDaysUntilEvent,
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
import type { Event } from "@/db/schema";

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

function StatusPill({ event }: { event: Event }) {
  if (event.scoringStatus === "open") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        Scoring live
      </span>
    );
  }

  if (event.scoringStatus === "finalized") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
        <Trophy className="size-3.5" />
        Complete
      </span>
    );
  }

  if (event.status === "draft") {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
        Draft
      </span>
    );
  }

  if (event.status === "closed") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-300">
        Registration closed
      </span>
    );
  }

  if (event.status === "archived") {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
        Archived
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
      <span className="size-1.5 rounded-full bg-primary" />
      Live — accepting registrations
    </span>
  );
}

function StatTile({
  label,
  value,
  caption,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-5">
      <div className="flex items-center gap-1.5 text-muted-foreground sm:gap-2">
        <Icon className="size-3.5 shrink-0 sm:size-4" />
        <span className="text-[10px] font-medium uppercase tracking-wide sm:text-xs">
          {label}
        </span>
      </div>
      <p className="mt-1.5 font-heading text-xl font-semibold tracking-tight sm:mt-2 sm:text-3xl">
        {value}
      </p>
      {caption && (
        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground sm:text-xs">
          {caption}
        </p>
      )}
      {children}
    </div>
  );
}

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
          if (event.scoringStatus !== "disabled") {
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

  const showNextStepBanner = nextStep && isDraft;

  const countdown = formatDaysUntilEvent(event.date);
  const eventUpcoming = getDaysUntilEvent(event.date) >= 0;
  const capacityPercent =
    event.maxPlayers > 0
      ? Math.min(100, Math.round((registrationCount / event.maxPlayers) * 100))
      : 0;
  const groupCount = pairings?.groups.length ?? 0;
  const unassignedCount = pairings?.unassigned.length ?? 0;
  const groupScoringProgress =
    isOperationalEvent && event.scoringStatus !== "disabled"
      ? await getGroupScoringProgress(event.id, event.format, event.holes)
      : null;

  return (
    <div className="mx-auto w-full min-w-0 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <ButtonLink
          variant="ghost"
          size="sm"
          href="/dashboard"
          className="w-fit shrink-0 text-muted-foreground"
        >
          <ArrowLeft />
          Events
        </ButtonLink>

        {isOperationalEvent && (
          <div className="flex shrink-0 gap-1 sm:gap-2">
            <ButtonLink
              variant="ghost"
              size="sm"
              href={`/e/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 text-muted-foreground sm:px-3"
              aria-label="Open event page"
            >
              <span className="hidden sm:inline">Event page</span>
              <ArrowUpRight className="sm:ml-1" />
            </ButtonLink>
            {(event.scoringStatus === "open" ||
              event.scoringStatus === "finalized") && (
              <ButtonLink
                variant="ghost"
                size="sm"
                href={`/e/${event.slug}/leaderboard`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 text-muted-foreground sm:px-3"
                aria-label="Open leaderboard"
              >
                <span className="hidden sm:inline">Leaderboard</span>
                <ArrowUpRight className="sm:ml-1" />
              </ButtonLink>
            )}
          </div>
        )}
      </div>

      {/* Notices */}
      {published === "1" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Payment received. Your event is live and accepting registrations.
        </div>
      )}

      {publish_canceled === "1" && (
        <div className="rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Publish checkout was canceled. Your event remains in draft.
        </div>
      )}

      {/* Hero */}
      <header className="space-y-5 sm:space-y-6">
        <div className="space-y-3 sm:space-y-4">
          <StatusPill event={event} />
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl lg:text-4xl">
              {event.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              <span className="block sm:inline">{formatEventHeaderDate(event.date)}</span>
              <span className="hidden sm:inline"> · </span>
              <span className="block sm:inline">{event.courseName}</span>
              <span className="hidden sm:inline"> · </span>
              <span className="block sm:inline">
                {getEventFormatLabel(event.format)}, {event.holes} holes
              </span>
            </p>
          </div>
        </div>

        {/* Stats */}
        {isOperationalEvent && (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <StatTile
              label="Players"
              value={`${registrationCount}`}
              caption={`of ${event.maxPlayers} spots filled`}
              icon={Users}
            >
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
            </StatTile>
            <StatTile
              label={eventUpcoming ? "Countdown" : "Played"}
              value={countdown.value}
              caption={countdown.caption}
              icon={CalendarDays}
            />
            <StatTile
              label="Groups"
              value={
                groupScoringProgress && groupScoringProgress.totalGroups > 0
                  ? `${groupScoringProgress.completedGroups}/${groupScoringProgress.totalGroups}`
                  : groupCount > 0
                    ? `${groupCount}`
                    : "—"
              }
              caption={
                groupScoringProgress && groupScoringProgress.totalGroups > 0
                  ? "groups completed"
                  : groupCount === 0
                    ? "No pairings yet"
                    : unassignedCount > 0
                      ? `${unassignedCount} player${unassignedCount === 1 ? "" : "s"} unassigned`
                      : "All players assigned"
              }
              icon={Users}
            />
            <StatTile
              label="Scoring"
              value={
                event.scoringStatus === "open"
                  ? "Live"
                  : event.scoringStatus === "finalized"
                    ? "Final"
                    : "Not started"
              }
              caption={
                event.scoringStatus === "disabled"
                  ? "Open when groups tee off"
                  : event.scoringStatus === "open"
                    ? "Players are entering scores"
                    : "Leaderboard published"
              }
              icon={Trophy}
            />
          </div>
        )}
      </header>

      <EventDetailView initialTab={activeTab} isDraft={isDraft}>
        {showNextStepBanner && nextStep && (
          <EventTabPanel tab="details">
            <EventDetailNextStep eventId={event.id} step={nextStep} />
          </EventTabPanel>
        )}

        {isDraft && (
          <>
            <EventTabPanel tab="details">
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle>Event details</CardTitle>
                      <CardDescription>
                        Set course, schedule, and registration settings. Changes
                        save to your draft.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <EventForm event={eventWithScorecard ?? undefined} />
                    </CardContent>
                  </Card>
                </EventTabPanel>

                <EventTabPanel tab="publish">
                  <>
                    <PublishEventCard
                      eventId={event.id}
                      eventName={event.name}
                      hasActiveSubscription={isOrgSubscriptionActive(org)}
                      subscribed={subscribed === "1"}
                      subscribeCanceled={subscribe_canceled === "1"}
                    />
                    <Card className="rounded-2xl border-dashed">
                      <CardHeader>
                        <CardTitle>Delete draft</CardTitle>
                        <CardDescription>
                          Permanently remove this draft and all associated data.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <DeleteEventButton
                          eventId={event.id}
                          eventName={event.name}
                          status={event.status}
                        />
                      </CardContent>
                    </Card>
                  </>
            </EventTabPanel>
          </>
        )}

        {isOperationalEvent && (
          <>
            <EventTabPanel tab="players">
                  <div className="space-y-6">
                    <Card className="rounded-2xl">
                      <CardHeader>
                        <CardTitle>Registration link</CardTitle>
                        <CardDescription>
                          Share with players — works on any phone, no app needed.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <CopyRegistrationLink url={registrationUrl} />
                        <ButtonLink
                          variant="outline"
                          size="sm"
                          href={`/e/${event.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink />
                          Preview registration page
                        </ButtonLink>
                      </CardContent>
                    </Card>

                    <RegistrationsList
                      eventId={event.id}
                      registrations={registrations}
                      registrationCount={registrationCount}
                      maxPlayers={event.maxPlayers}
                      scoringStatus={event.scoringStatus}
                      eventStatus={event.status}
                    />
                  </div>
                </EventTabPanel>

                {pairings && (
                  <EventTabPanel tab="pairings">
                    <div className="space-y-4 sm:space-y-6">
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
                        teamAName={event.teamAName}
                        teamBName={event.teamBName}
                        pairings={pairings}
                      />
                    </div>
                  </EventTabPanel>
                )}

                {workflow && (
                  <EventTabPanel tab="scoring">
                    <ScoringCard
                      eventId={event.id}
                      slug={event.slug}
                      scoringStatus={event.scoringStatus}
                      scoringCode={event.scoringCode}
                      appUrl={getAppUrl()}
                      canOpenScoring={workflow.canOpenScoring}
                      workflow={workflow}
                      groupScoringProgress={groupScoringProgress}
                    />
                  </EventTabPanel>
                )}

                <EventTabPanel tab="features">
                  <div className="space-y-6">
                    <ProFeaturesPanel event={event} />
                    <EventBrandingPanel event={event} />
                    <FlightsPanel eventId={event.id} flights={flights} />
                    <SponsorPackagesPanel
                      eventId={event.id}
                      packages={sponsorData.packages}
                      purchases={sponsorData.purchases}
                    />
                    {event.waitlistEnabled && waitlist.length > 0 && (
                      <Card className="rounded-2xl">
                        <CardHeader>
                          <CardTitle>Waitlist</CardTitle>
                          <CardDescription>
                            {waitlist.length} player
                            {waitlist.length === 1 ? "" : "s"} waiting for a
                            spot.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            {waitlist.map((entry) => (
                              <li
                                key={entry.id}
                                className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
                              >
                                <span>
                                  {entry.name} · {entry.email}
                                </span>
                                <span className="text-muted-foreground">
                                  {entry.notifiedAt ? "Notified" : "Waiting"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </EventTabPanel>

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
                          Analytics will appear here once players register for
                          your event.
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  )}
                </EventTabPanel>

                <EventTabPanel tab="settings">
                  <div className="space-y-6">
                    <EventLifecycleCard event={event} />

                    {event.status === "published" && (
                      <Card className="rounded-2xl">
                        <CardHeader>
                          <CardTitle>Registration window</CardTitle>
                          <CardDescription>
                            Set when players can register. Leave blank to use
                            defaults.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <RegistrationWindowFields
                            eventId={event.id}
                            opensAt={event.registrationOpens}
                            closesAt={event.registrationCloses}
                            editable
                          />
                        </CardContent>
                      </Card>
                    )}

                    <PayoutInfoCard />

                    <Card className="rounded-2xl">
                      <CardHeader>
                        <CardTitle>Event details</CardTitle>
                        <CardDescription>
                          Core settings for this event. Contact support if you
                          need to change course or format after publishing.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        <dl className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
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
                            ...(eventWithScorecard?.eventHoles &&
                            eventWithScorecard.eventHoles.length > 0
                              ? [
                                  {
                                    label: "Scorecard",
                                    value: `Par ${eventWithScorecard.eventHoles.reduce(
                                      (sum, hole) => sum + hole.par,
                                      0
                                    )} · ${eventWithScorecard.eventHoles.length} holes`,
                                  },
                                ]
                              : []),
                          ].map((row) => (
                            <div
                              key={row.label}
                              className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-3"
                            >
                              <dt className="text-muted-foreground">
                                {row.label}
                              </dt>
                              <dd className="text-right font-medium">
                                {row.value}
                              </dd>
                            </div>
                          ))}
                        </dl>

                        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                          <h3 className="text-sm font-medium">Danger zone</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Permanently delete this event, including
                            registrations, pairings, and scores.
                          </p>
                          <div className="mt-4">
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
    </div>
  );
}
