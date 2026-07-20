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

import { getEventById, getEventByIdWithScorecard } from "@/actions/events";
import { syncPublishIfPaid } from "@/actions/publish";
import { CopyRegistrationLink } from "@/components/dashboard/copy-registration-link";
import { CaddieModeCard } from "@/components/dashboard/caddie-mode-card";
import { EventDetailTabs } from "@/components/dashboard/event-detail-tabs";
import { EventForm } from "@/components/dashboard/event-form";
import { PairingsPanel } from "@/components/dashboard/pairings-panel";
import { PublishEventCard } from "@/components/dashboard/publish-event-card";
import { RegistrationsList } from "@/components/dashboard/registrations-list";
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
import { getPlatformFeeCents, getAppUrl } from "@/lib/stripe";
import { syncEventScoringCodes } from "@/actions/scoring";
import { syncTeeTimesForEvent } from "@/actions/start-format";
import { getEventPairings } from "@/lib/pairings";
import { requireOrganization } from "@/lib/auth";
import { getEventFormatLabel } from "@/lib/event-formats";
import { getPublishedGolfCourseByExternalId } from "@/lib/golf-courses";
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
  const activeTab = parseEventTab(tab, isDraft);
  const registrationUrl = `${getAppUrl()}/e/${event.slug}`;
  const registrationCount = await getRegistrationCount(event.id);
  const registrations =
    event.status === "published"
      ? await getRegistrationsForEvent(event.id, org.id)
      : [];
  const pairings =
    event.status === "published"
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

  const publishedGolfCourse = event.externalCourseId
    ? await getPublishedGolfCourseByExternalId(event.externalCourseId)
    : null;

  const nextStep = getCurrentSetupStep({
    isDraft,
    registrationCount,
    pairings,
    scoringStatus: event.scoringStatus,
  });

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

        {event.status === "published" && (
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
        {event.status === "published" && (
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
        {/* Next step */}
        {nextStep &&
          ((isDraft && activeTab === "details") ||
            (!isDraft && activeTab === "overview")) && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm sm:p-6">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                  Up next
                </p>
                <p className="mt-1 font-heading text-lg font-semibold">
                  {nextStep.label}
                </p>
                <p className="mt-0.5 text-sm opacity-90">
                  {nextStep.description}
                </p>
              </div>
              <ButtonLink
                href={eventTabHref(event.id, nextStep.tab)}
                variant="secondary"
                className="shrink-0 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                Continue
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
              platformFeeCents={getPlatformFeeCents()}
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

        {/* Published: overview */}
        {event.status === "published" && activeTab === "overview" && (
          <>
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Registration link</CardTitle>
                <CardDescription>
                  Share this link with players — works on any phone, no app
                  needed.
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

            <CaddieModeCard
              eventSlug={event.slug}
              externalCourseId={event.externalCourseId}
              courseName={event.courseName}
              publishedMapAvailable={publishedGolfCourse != null}
              publishedMappedHoles={publishedGolfCourse?.mappedHoleCount ?? 0}
              dataQuality={publishedGolfCourse?.dataQuality ?? null}
            />
          </>
        )}

        {/* Published: players */}
        {event.status === "published" && activeTab === "players" && (
          <RegistrationsList
            eventId={event.id}
            registrations={registrations}
            registrationCount={registrationCount}
            maxPlayers={event.maxPlayers}
            scoringStatus={event.scoringStatus}
          />
        )}

        {/* Published: pairings */}
        {event.status === "published" && activeTab === "pairings" && (
          pairings && (
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
          )
        )}

        {/* Published: scoring */}
        {event.status === "published" && activeTab === "scoring" && (
          <ScoringCard
            eventId={event.id}
            slug={event.slug}
            scoringStatus={event.scoringStatus}
            scoringCode={event.scoringCode}
            appUrl={getAppUrl()}
          />
        )}

        {/* Published: settings */}
        {event.status === "published" && activeTab === "settings" && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Event settings</CardTitle>
              <CardDescription>
                Published events are read-only. Contact support to request
                changes.
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
        )}
      </div>
    </div>
  );
}
