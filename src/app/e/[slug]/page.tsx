import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Clock, Flag, MapPin, Trophy } from "lucide-react";

import {
  formatEventDate,
  formatFee,
  getPublishedEventBySlug,
  getRegistrationCount,
  getPublicRegistrationMessage,
  isRegistrationOpen,
} from "@/lib/events";
import { getEventFormatLabel } from "@/lib/event-formats";
import { getStartFormatSummary } from "@/lib/start-format";
import { RegistrationForm } from "@/components/public/registration-form";
import { ButtonLink } from "@/components/ui/button-link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type PublicEventPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ canceled?: string }>;
};

export default async function PublicEventPage({
  params,
  searchParams,
}: PublicEventPageProps) {
  const { slug } = await params;
  const { canceled } = await searchParams;
  const event = await getPublishedEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const registrationCount = await getRegistrationCount(event.id);
  const spotsLeft = Math.max(0, event.maxPlayers - registrationCount);
  const soldOut = spotsLeft === 0;
  const registrationClosed = !isRegistrationOpen(event);
  const registrationDescription = soldOut
    ? "This event is at capacity."
    : getPublicRegistrationMessage(event);

  return (
    <div className="min-h-full bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-4 sm:h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Flag className="size-4" />
            </div>
            <span className="font-heading text-base font-semibold">OpenRound</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-12">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {event.organization.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {event.name}
          </h1>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{getEventFormatLabel(event.format)}</Badge>
            <Badge variant="outline">{event.holes} holes</Badge>
            <Badge variant="outline">{formatFee(event.entryFeeCents)}</Badge>
          </div>
        </div>

        <div className="mt-6 space-y-3 text-sm">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Calendar className="size-4 shrink-0 text-primary" />
            {formatEventDate(event.date)}
          </div>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <MapPin className="size-4 shrink-0 text-primary" />
            {event.courseName}
          </div>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Clock className="size-4 shrink-0 text-primary" />
            {getStartFormatSummary({
              startFormat: event.startFormat,
              shotgunStartTime: event.shotgunStartTime,
              firstTeeTime: event.firstTeeTime,
              teeTimeIntervalMinutes: event.teeTimeIntervalMinutes,
            })}
          </div>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Trophy className="size-4 shrink-0 text-primary" />
            {registrationCount} / {event.maxPlayers} registered
          </div>
        </div>

        {event.description && (
          <>
            <Separator className="my-6" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          </>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Register</CardTitle>
            <CardDescription>
              {registrationDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canceled === "1" && (
              <p className="mb-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Payment was canceled. You can try again below.
              </p>
            )}
            <RegistrationForm
              slug={slug}
              entryFeeCents={event.entryFeeCents}
              spotsLeft={spotsLeft}
              soldOut={soldOut}
              registrationClosed={registrationClosed}
            />
          </CardContent>
        </Card>

        {event.scoringStatus !== "disabled" && (
          <ButtonLink
            variant="outline"
            className="mt-6 w-full"
            href={`/e/${slug}/leaderboard`}
          >
            <Trophy />
            View live leaderboard
          </ButtonLink>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by OpenRound ·{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy
          </Link>
        </p>
      </main>
    </div>
  );
}
