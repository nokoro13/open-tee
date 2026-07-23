import { Suspense } from "react";

import { getEventsForOrg } from "@/actions/events";
import {
  EventsEmptyState,
  EventsList,
  EventsPageHeader,
} from "@/components/dashboard/events-section-list";
import { requireOrganization } from "@/lib/auth";
import { getRegistrationCountsByEventIds } from "@/lib/events";
import { Skeleton } from "@/components/ui/skeleton";

function EventsListFallback() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-72 rounded-full" />
      <div className="overflow-hidden rounded-2xl border">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-t border-border/70 px-6 py-4 first:border-t-0"
          >
            <Skeleton className="h-16 w-14 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const org = await requireOrganization();
  const eventList = await getEventsForOrg();
  const publishedIds = eventList
    .filter((event) => event.status === "published")
    .map((event) => event.id);
  const registrationCounts = await getRegistrationCountsByEventIds(publishedIds);

  return (
    <div className="mx-auto w-full space-y-8">
      <EventsPageHeader orgName={org.name} eventCount={eventList.length} />

      {eventList.length === 0 ? (
        <EventsEmptyState />
      ) : (
        <Suspense fallback={<EventsListFallback />}>
          <EventsList events={eventList} registrationCounts={registrationCounts} />
        </Suspense>
      )}
    </div>
  );
}
