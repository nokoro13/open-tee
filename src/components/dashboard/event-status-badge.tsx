import { Trophy } from "lucide-react";

import type { Event } from "@/db/schema";
import { cn } from "@/lib/utils";

type EventStatusBadgeProps = {
  event: Pick<Event, "status" | "scoringStatus">;
  size?: "sm" | "md";
  className?: string;
};

export function EventStatusBadge({
  event,
  size = "md",
  className,
}: EventStatusBadgeProps) {
  const sizeClass =
    size === "sm"
      ? "max-w-full px-2 py-0.5 text-[11px] gap-1 whitespace-nowrap"
      : "max-w-full px-2.5 py-1 text-xs sm:px-3 sm:text-sm gap-1.5 sm:gap-2 whitespace-nowrap";

  const badgeClassName = (variant: string) =>
    cn(
      "inline-flex w-fit max-w-full items-center rounded-full font-medium",
      variant,
      sizeClass,
      className
    );

  if (event.scoringStatus === "open") {
    return (
      <span className={badgeClassName("bg-primary/10 text-primary")}>
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        {size === "sm" ? "Live" : "Scoring live"}
      </span>
    );
  }

  if (event.scoringStatus === "finalized") {
    return (
      <span className={badgeClassName("bg-muted text-muted-foreground")}>
        <Trophy className={size === "sm" ? "size-3" : "size-3.5"} />
        Complete
      </span>
    );
  }

  if (event.status === "draft") {
    return (
      <span
        className={badgeClassName(
          "bg-secondary text-secondary-foreground"
        )}
      >
        Draft
      </span>
    );
  }

  if (event.status === "closed") {
    return (
      <span
        className={badgeClassName(
          "bg-amber-500/10 text-amber-800 dark:text-amber-300"
        )}
      >
        {size === "sm" ? "Closed" : "Registration closed"}
      </span>
    );
  }

  if (event.status === "archived") {
    return (
      <span className={badgeClassName("bg-muted text-muted-foreground")}>
        Archived
      </span>
    );
  }

  return (
    <span className={badgeClassName("bg-primary/10 text-primary")}>
      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
      {size === "sm" ? (
        "Live"
      ) : (
        <>
          <span className="sm:hidden">Live</span>
          <span className="hidden sm:inline">Live — accepting registrations</span>
        </>
      )}
    </span>
  );
}
