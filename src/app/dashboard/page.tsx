import { CalendarPlus } from "lucide-react";

import { getEventsForOrg } from "@/actions/events";
import { EventCard } from "@/components/dashboard/event-card";
import { requireOrganization } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const org = await requireOrganization();
  const eventList = await getEventsForOrg();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Your events
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {org.name} · {eventList.length}{" "}
            {eventList.length === 1 ? "event" : "events"}
          </p>
        </div>
        <ButtonLink
          size="lg"
          href="/dashboard/events/new"
          className="h-11 w-full sm:w-auto"
        >
          <CalendarPlus />
          New event
        </ButtonLink>
      </div>

      {eventList.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No events yet</CardTitle>
            <CardDescription>
              Create your first tournament draft. You can build for free and
              publish when you&apos;re ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ButtonLink
              size="lg"
              href="/dashboard/events/new"
              className="h-11 w-full sm:w-auto"
            >
              <CalendarPlus />
              Create draft event
            </ButtonLink>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {eventList.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
