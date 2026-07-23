"use client";

import { Suspense } from "react";

import {
  EventsList,
  EventsPageHeader,
} from "@/components/dashboard/events-section-list";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PREVIEW_ORG_NAME,
  previewDashboardEvents,
  previewDashboardRegistrationCounts,
} from "@/lib/landing-preview-data";
import { cn } from "@/lib/utils";

type DashboardPreviewContentProps = {
  compact?: boolean;
};

function EventsListFallback() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-72 rounded-full" />
      <div className="overflow-hidden rounded-2xl border">
        {Array.from({ length: 3 }).map((_, index) => (
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

export function DashboardPreviewContent({
  compact = false,
}: DashboardPreviewContentProps) {
  const events = compact
    ? previewDashboardEvents.slice(0, 3)
    : previewDashboardEvents;

  return (
    <div className={cn("mx-auto w-full max-w-5xl space-y-8", compact && "space-y-6")}>
      <EventsPageHeader
        orgName={PREVIEW_ORG_NAME}
        eventCount={previewDashboardEvents.length}
        preview
      />
      <Suspense fallback={<EventsListFallback />}>
        <EventsList
          events={events}
          registrationCounts={previewDashboardRegistrationCounts}
          preview
          activeFilter="all"
        />
      </Suspense>
    </div>
  );
}
