import { getEventsForOrg } from "@/actions/events";
import { EventCard } from "@/components/dashboard/event-card";
import { requireOrganization } from "@/lib/auth";
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Your events
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {org.name} · {eventList.length}{" "}
          {eventList.length === 1 ? "event" : "events"}
        </p>
      </div>

      {eventList.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No events yet</CardTitle>
            <CardDescription>
              Pick a format from the sidebar to create your first tournament
              draft. You can build for free and publish when you&apos;re ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Use the <span className="font-medium text-foreground">Create</span>{" "}
              section in the sidebar to jump straight into an event form.
            </p>
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
