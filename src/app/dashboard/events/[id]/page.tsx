import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  Trophy,
  Users,
} from "lucide-react";

import { syncRegistrationWorkflow } from "@/actions/event-workflow";
import { getEventById, getEventByIdWithScorecard } from "@/actions/events";
import { syncPublishIfPaid } from "@/actions/publish";
import { CopyRegistrationLink } from "@/components/dashboard/copy-registration-link";
import { EventDetailTabs } from "@/components/dashboard/event-detail-tabs";
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
  eventTabHref,
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
import { getEventPlatformTier, isProEvent } from "@/lib/platform-tier";
import { buildEventWorkflowSnapshot } from "@/lib/event-workflow";
import { getAppUrl } from "@/lib/stripe";
import { syncEventScoringCodes } from "@/actions/scoring";
import { syncTeeTimesForEvent } from "@/actions/start-format";
import { getEventPairings } from "@/lib/pairings";
import { requireOrganization } from "@/lib/auth";
import { getEventFormatLabel } from "@/lib/event-formats";
import { cn } from "@/lib/utils";
import type { Event } from "@/db/schema";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    published?: string;
    publish_canceled?: string;
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
    <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        {value}
      </p>
      {caption && (
        <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
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
  const { published, publish_canceled, tab } = await searchParams;
  const org = await requireOrganization();
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
  const registrationCount = isOperationalEvent
    ? await getRegistrationCount(event.id)
    : 0;
  const registrations = isOperationalEvent
    ? await getRegistrationsForEvent(event.id, org.id)
    : [];
  const pairings = isOperationalEvent
      ? await (async () => {
          if (event.scoringStatus !== "disabled") {
            await syncEventScoringCodes(event.id);
          }
          if (event.startFormat === "tee_times") {
            await syncTeeTimesForEvent(event.id);
          }
          return getEventPairings(event.id, org.id);
        })()
      : null;

  const flights = isOperationalEvent && isProEvent(event)
    ? await getFlightsForEvent(event.id, org.id)
    : [];

  const sponsorData =
    isOperationalEvent && isProEvent(event)
      ? await getSponsorPackagesForDashboard(event.id, org.id)
      : { packages: [], purchases: [] };

  const waitlist =
    isOperationalEvent && isProEvent(event) && event.waitlistEnabled
      ? await getWaitlistForEvent(event.id, org.id)
      : [];

  const analyticsReport =
    isOperationalEvent && isProEvent(event)
      ? await buildEventAnalyticsReport(event.id, org.id)
      : null;

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

  const showNextStepBanner =
    nextStep && isDraft && activeTab === "details";

  const countdown = formatDaysUntilEvent(event.date);
  const eventUpcoming = getDaysUntilEvent(event.date) >= 0;
  const capacityPercent =
    event.maxPlayers > 0
      ? Math.min(100, Math.round((registrationCount / event.maxPlayers) * 100))
      : 0;
  const groupCount = pairings?.groups.length ?? 0;
  const unassignedCount = pairings?.unassigned.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <ButtonLink
          variant="ghost"
          size="sm"
          href="/dashboard"
          className="-ml-2 w-fit text-muted-foreground"
        >
          <ArrowLeft />
          Events
        </ButtonLink>

        {isOperationalEvent && (
          <div className="flex gap-2">
            <ButtonLink
              variant="ghost"
              size="sm"
              href={`/e/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground"
            >
              Event page
              <ArrowUpRight />
            </ButtonLink>
            {(event.scoringStatus === "open" ||
              event.scoringStatus === "finalized") && (
              <ButtonLink
                variant="ghost"
                size="sm"
                href={`/e/${event.slug}/leaderboard`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground"
              >
                Leaderboard
                <ArrowUpRight />
              </ButtonLink>
            )}
          </div>
        )}
      </div>

      {/* Notices */}
      {published === "1" && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Payment received. Your event is live and accepting registrations.
        </div>
      )}

      {publish_canceled === "1" && (
        <div className="mt-4 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Publish checkout was canceled. Your event remains in draft.
        </div>
      )}

      {/* Hero */}
      <header className="mt-8 space-y-6">
        <div className="space-y-4">
          <StatusPill event={event} />
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {event.name}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              {formatEventHeaderDate(event.date)} · {event.courseName} ·{" "}
              {getEventFormatLabel(event.format)}, {event.holes} holes
            </p>
          </div>
        </div>

        {/* Stats */}
        {isOperationalEvent && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
              value={groupCount > 0 ? `${groupCount}` : "—"}
              caption={
                groupCount === 0
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

        <EventDetailTabs
          eventId={event.id}
          activeTab={activeTab}
          isDraft={isDraft}
        />
      </header>

      <div className="mt-8 space-y-6">
        {/* Next step — only when it navigates to a different tab */}
        {showNextStepBanner && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm sm:p-6">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                  Up next
                </p>
                <p className="mt-1 font-heading text-lg font-semibold">
                  {nextStep!.label}
                </p>
                <p className="mt-0.5 text-sm opacity-90">
                  {nextStep!.description}
                </p>
              </div>
              <ButtonLink
                href={nextStep!.href ?? eventTabHref(event.id, nextStep!.tab)}
                variant="secondary"
                className="shrink-0 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                {...(nextStep!.href
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {nextStep!.href ? "Print" : "Continue"}
                <ArrowRight />
              </ButtonLink>
            </div>
          )}

        {/* Draft: details */}
        {isDraft && activeTab === "details" && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Event details</CardTitle>
              <CardDescription>
                Set course, schedule, and registration settings. Changes save to
                your draft.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventForm event={eventWithScorecard ?? undefined} />
            </CardContent>
          </Card>
        )}

        {/* Draft: publish */}
        {isDraft && activeTab === "publish" && (
          <>
            <PublishEventCard
              eventId={event.id}
              eventName={event.name}
              currentTier={getEventPlatformTier(event)}
              maxPlayers={event.maxPlayers}
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
        )}

        {/* Published: players */}
        {isOperationalEvent && activeTab === "players" && (
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
        )}

        {/* Published: pairings */}
        {isOperationalEvent && activeTab === "pairings" && pairings && (
          <div className="space-y-6">
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
        )}

        {/* Published: scoring */}
        {isOperationalEvent && activeTab === "scoring" && workflow && (
          <ScoringCard
            eventId={event.id}
            slug={event.slug}
            scoringStatus={event.scoringStatus}
            scoringCode={event.scoringCode}
            appUrl={getAppUrl()}
            canOpenScoring={workflow.canOpenScoring}
            workflow={workflow}
          />
        )}

        {/* Published: pro */}
        {isOperationalEvent && activeTab === "pro" && (
          isProEvent(event) ? (
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
                      {waitlist.length} player{waitlist.length === 1 ? "" : "s"} waiting for a spot.
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
          ) : (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Pro features</CardTitle>
                <CardDescription>
                  Branding, sponsors, waitlist, group registration, SMS, flights, and analytics are available on Pro events.
                </CardDescription>
              </CardHeader>
            </Card>
          )
        )}

        {/* Published: analytics */}
        {isOperationalEvent && activeTab === "analytics" && (
          analyticsReport ? (
            <EventAnalyticsReportCard eventId={event.id} report={analyticsReport} />
          ) : (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
                <CardDescription>
                  Post-event analytics reports are included with Pro events.
                </CardDescription>
              </CardHeader>
            </Card>
          )
        )}

        {/* Published: settings */}
        {isOperationalEvent && activeTab === "settings" && (
          <div className="space-y-6">
            <EventLifecycleCard event={event} />

            {event.status === "published" && (
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Registration window</CardTitle>
                  <CardDescription>
                    Set when players can register. Leave blank to use defaults.
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
                  Core settings for this event. Contact support if you need to
                  change course or format after publishing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <dl className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
                  {[
                    { label: "Course", value: event.courseName },
                    { label: "Date", value: formatEventHeaderDate(event.date) },
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
                    { label: "Capacity", value: `${event.maxPlayers} players` },
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
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="text-right font-medium">{row.value}</dd>
                    </div>
                  ))}
                </dl>

                <div
                  className={cn(
                    "rounded-xl border border-destructive/20 bg-destructive/5 p-4"
                  )}
                >
                  <h3 className="text-sm font-medium">Danger zone</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Permanently delete this event, including registrations,
                    pairings, and scores.
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
        )}
      </div>
    </div>
  );
}
