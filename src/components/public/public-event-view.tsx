import { Calendar, Clock, Flag, MapPin, Trophy } from "lucide-react";

import { RegistrationForm } from "@/components/public/registration-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatEventDate, formatFee } from "@/lib/events";
import { getEventFormatLabel } from "@/lib/event-formats";
import { getStartFormatSummary } from "@/lib/start-format";
import type { Event } from "@/db/schema";

type PublicEventViewProps = {
  event: Event & { organization: { name: string } };
  registrationCount: number;
  spotsLeft: number;
  soldOut: boolean;
  registrationClosed: boolean;
  demoMode?: boolean;
};

export function PublicEventView({
  event,
  registrationCount,
  spotsLeft,
  soldOut,
  registrationClosed,
  demoMode = false,
}: PublicEventViewProps) {
  return (
    <div className="min-h-full bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-4 sm:h-16">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Flag className="size-4" />
            </div>
            <span className="font-heading text-base font-semibold">OpenRound</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-12">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{event.organization.name}</p>
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
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          </>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Register</CardTitle>
            <CardDescription>
              Complete the form below to secure your spot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationForm
              slug={event.slug}
              entryFeeCents={event.entryFeeCents}
              spotsLeft={spotsLeft}
              soldOut={soldOut}
              registrationClosed={registrationClosed}
              demoMode={demoMode}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
