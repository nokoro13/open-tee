import { Plus } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { EventsList } from "@/components/dashboard/events-list";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

export function EventsPageHeader({
  orgName,
  preview = false,
}: {
  orgName: string;
  eventCount?: number;
  preview?: boolean;
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <DashboardPageHeader
      eyebrow={`${orgName} · ${today}`}
      title="Events"
      description="Create and manage your tournaments from one place."
      actions={
        preview ? (
          <Button size="lg" className="rounded-full" type="button" tabIndex={-1}>
            <Plus />
            New event
          </Button>
        ) : (
          <ButtonLink href="/dashboard/events/new" size="lg" className="rounded-full">
            <Plus />
            New event
          </ButtonLink>
        )
      }
    />
  );
}

export function EventsEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center ring-1 ring-foreground/5 sm:py-20">
      <h2 className="font-heading text-xl font-semibold">
        Host your first tournament
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-pretty text-muted-foreground">
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
