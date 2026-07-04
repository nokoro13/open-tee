import Link from "next/link";
import { Calendar, ChevronRight, MapPin } from "lucide-react";

import type { Event } from "@/db/schema";
import { DeleteEventButton } from "@/components/dashboard/delete-event-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

export function EventCard({ event }: { event: Event }) {
  return (
    <Card className="border-border/60 transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-2 sm:gap-4">
        <Link
          href={`/dashboard/events/${event.id}`}
          className="flex min-w-0 flex-1 items-center gap-4 active:scale-[0.99]"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={event.status === "draft" ? "secondary" : "default"}
              >
                {statusLabels[event.status]}
              </Badge>
              <Badge variant="outline">{getEventFormatLabel(event.format)}</Badge>
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
            </div>
            <p className="text-sm text-muted-foreground">
              {formatFee(event.entryFeeCents)} · up to {event.maxPlayers} players
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
        <DeleteEventButton
          eventId={event.id}
          eventName={event.name}
          status={event.status}
          variant="compact"
        />
      </CardContent>
    </Card>
  );
}
