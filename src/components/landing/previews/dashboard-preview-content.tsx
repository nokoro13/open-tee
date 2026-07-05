import { EventCard } from "@/components/dashboard/event-card";
import {
  PREVIEW_ORG_NAME,
  previewDashboardEvents,
} from "@/lib/landing-preview-data";
import { cn } from "@/lib/utils";

type DashboardPreviewContentProps = {
  compact?: boolean;
};

export function DashboardPreviewContent({
  compact = false,
}: DashboardPreviewContentProps) {
  const events = compact
    ? previewDashboardEvents.slice(0, 2)
    : previewDashboardEvents;

  return (
    <div className={cn("space-y-6", compact && "space-y-4")}>
      <div>
        <h1
          className={cn(
            "font-semibold tracking-tight",
            compact ? "text-xl" : "text-2xl sm:text-3xl"
          )}
        >
          Your events
        </h1>
        <p
          className={cn(
            "mt-1 text-muted-foreground",
            compact ? "text-sm" : "text-sm sm:text-base"
          )}
        >
          {PREVIEW_ORG_NAME} · {previewDashboardEvents.length} events
        </p>
      </div>

      <div className={cn("grid gap-3", !compact && "sm:gap-4")}>
        {events.map((event) => (
          <EventCard key={event.id} event={event} preview />
        ))}
      </div>
    </div>
  );
}
