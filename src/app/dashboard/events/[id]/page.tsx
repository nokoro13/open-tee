import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { getEventById, getEventByIdWithScorecard } from "@/actions/events";
import { syncPublishIfPaid } from "@/actions/publish";
import { CopyRegistrationLink } from "@/components/dashboard/copy-registration-link";
import { CaddieModeCard } from "@/components/dashboard/caddie-mode-card";
import { EventForm } from "@/components/dashboard/event-form";
import { PairingsPanel } from "@/components/dashboard/pairings-panel";
import { PublishEventCard } from "@/components/dashboard/publish-event-card";
import { RegistrationsList } from "@/components/dashboard/registrations-list";
import { ScoringCard } from "@/components/dashboard/scoring-card";
import { StartFormatCard } from "@/components/dashboard/start-format-card";
import { DeleteEventButton } from "@/components/dashboard/delete-event-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  eventSetupLockedMessage,
  isEventSetupLocked,
} from "@/lib/event-setup-lock";
import {
  getLatestMappingRequestForEvent,
  getPublishedGolfCourseByExternalId,
} from "@/lib/golf-courses";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string; publish_canceled?: string }>;
};

export default async function EventDetailPage({
  params,
  searchParams,
}: EventDetailPageProps) {
  const { id } = await params;
  const { published, publish_canceled } = await searchParams;
  const org = await requireOrganization();
  let event = await getEventById(id);

  if (!event) {
    notFound();
  }

  const eventWithScorecard = await getEventByIdWithScorecard(id);

  if (published === "1" && event.status === "draft") {
    event = (await syncPublishIfPaid(id)) ?? event;
  }

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
  const latestMappingRequest = await getLatestMappingRequestForEvent(event.id);

  return (
    <div className="space-y-6">
      <ButtonLink
        variant="ghost"
        size="sm"
        href="/dashboard"
        className="-ml-2 w-fit"
      >
        <ArrowLeft />
        Back to events
      </ButtonLink>

      {published === "1" && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Payment received! Your event is live and accepting registrations.
        </div>
      )}

      {publish_canceled === "1" && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Publish checkout was canceled. Your event is still in draft.
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={event.status === "draft" ? "secondary" : "default"}>
            {event.status}
          </Badge>
          <Badge variant="outline">{getEventFormatLabel(event.format)}</Badge>
          <Badge variant="outline">{event.holes} holes</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {event.name}
        </h1>
      </div>

      {event.status === "draft" && (
        <PublishEventCard
          eventId={event.id}
          eventName={event.name}
          platformFeeCents={getPlatformFeeCents()}
        />
      )}

      {event.status === "published" && isEventSetupLocked(event.scoringStatus) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          {eventSetupLockedMessage(event.scoringStatus)}
        </div>
      )}

      {event.status === "published" && (
        <Card>
          <CardHeader>
            <CardTitle>Registration link</CardTitle>
            <CardDescription>
              {isEventSetupLocked(event.scoringStatus)
                ? "Public registration is closed while scoring is active."
                : "Share this link with players. Works on any phone — no app needed."}
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
      )}

      {event.status === "published" && (
        <RegistrationsList
          eventId={event.id}
          registrations={registrations}
          registrationCount={registrationCount}
          maxPlayers={event.maxPlayers}
          scoringStatus={event.scoringStatus}
        />
      )}

      {event.status === "published" && (
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
      )}

      {event.status === "published" && pairings && (
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
      )}

      {event.status === "published" && (
        <CaddieModeCard
          eventId={event.id}
          eventSlug={event.slug}
          externalCourseId={event.externalCourseId}
          courseName={event.courseName}
          publishedMapAvailable={publishedGolfCourse != null}
          publishedMappedHoles={publishedGolfCourse?.mappedHoleCount ?? 0}
          dataQuality={publishedGolfCourse?.dataQuality ?? null}
          latestRequest={
            latestMappingRequest
              ? {
                  id: latestMappingRequest.id,
                  status: latestMappingRequest.status,
                  mappedHoleCount: latestMappingRequest.course.mappedHoleCount,
                }
              : null
          }
        />
      )}

      {event.status === "published" && (
        <ScoringCard
          eventId={event.id}
          slug={event.slug}
          scoringStatus={event.scoringStatus}
          scoringCode={event.scoringCode}
          appUrl={getAppUrl()}
        />
      )}

      {event.status === "draft" && (
        <Card>
          <CardHeader>
            <CardTitle>Edit event</CardTitle>
            <CardDescription>
              Update details before publishing. Changes are saved to your draft.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventForm event={eventWithScorecard ?? undefined} />
          </CardContent>
        </Card>
      )}

      {event.status === "published" && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Event settings</CardTitle>
            <CardDescription>
              Published events are read-only for now. Contact support to make
              changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p>Course: {event.courseName}</p>
              {eventWithScorecard?.eventHoles &&
                eventWithScorecard.eventHoles.length > 0 && (
                  <p>
                    Scorecard: Par{" "}
                    {eventWithScorecard.eventHoles.reduce(
                      (sum, hole) => sum + hole.par,
                      0
                    )}{" "}
                    ({eventWithScorecard.eventHoles.length} holes)
                  </p>
                )}
              <p>Date: {event.date}</p>
              <p>
                Entry fee:{" "}
                {event.entryFeeCents === 0
                  ? "Free"
                  : `$${(event.entryFeeCents / 100).toFixed(2)}`}
              </p>
            </div>
            <DeleteEventButton
              eventId={event.id}
              eventName={event.name}
              status={event.status}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
