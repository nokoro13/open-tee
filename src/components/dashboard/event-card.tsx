import Link from "next/link";
import { Calendar, MapPin, Users } from "lucide-react";

import type { Event } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getScoringStatusLabel } from "@/lib/event-dashboard";
import { getEventFormatLabel } from "@/lib/event-formats";

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFee(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const statusLabels: Record<Event["status"], string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
  archived: "Archived",
};

export function EventCard({
  event,
  preview = false,
  registrationCount = 0,
}: {
  event: Event;
  preview?: boolean;
  registrationCount?: number;
}) {
  const scoringLabel = getScoringStatusLabel(event.scoringStatus);

  const cardBody = (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={event.status === "draft" ? "secondary" : "default"}>
          {statusLabels[event.status]}
        </Badge>
        <Badge variant="outline">{getEventFormatLabel(event.format)}</Badge>
        {scoringLabel && (
          <Badge variant="outline" className="border-primary/30 text-primary">
            {scoringLabel}
          </Badge>
        )}
      </div>
      <h3 className="truncate font-medium">{event.name}</h3>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-3.5 shrink-0" />
          {formatDate(event.date)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" />
          {event.courseName}
        </span>
        {event.status === "published" && (
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5 shrink-0" />
            {registrationCount} / {event.maxPlayers} registered
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {formatFee(event.entryFeeCents)} · up to {event.maxPlayers} players
      </p>
    </div>
  );

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 sm:p-6">
        {preview ? (
          cardBody
        ) : (
          <Link
            href={`/dashboard/events/${event.id}`}
            className="block active:scale-[0.99]"
          >
            {cardBody}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
