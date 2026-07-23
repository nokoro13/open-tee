import { Plus } from "lucide-react";

import { EventsList } from "@/components/dashboard/events-list";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

export function EventsPageHeader({
  orgName,
  eventCount,
  preview = false,
}: {
  orgName: string;
  eventCount: number;
  preview?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">{orgName}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Events
        </h1>
      </div>
      {preview ? (
        <Button size="lg" className="rounded-full" type="button" tabIndex={-1}>
          <Plus />
          New event
        </Button>
      ) : (
        <ButtonLink href="/dashboard/events/new" size="lg" className="rounded-full">
          <Plus />
          New event
        </ButtonLink>
      )}
    </div>
  );
}

export function EventsEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed px-6 py-20 text-center">
      <h2 className="font-heading text-xl font-semibold">
        Host your first tournament
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Registration, pairings, live scoring, and leaderboards — everything you
        need to run event day, in one place.
      </p>
      <div className="mt-8">
        <ButtonLink href="/dashboard/events/new" size="lg" className="rounded-full">
          <Plus />
          Create an event
        </ButtonLink>
      </div>
    </div>
  );
}

export { EventsList };
