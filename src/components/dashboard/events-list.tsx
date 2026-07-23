"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import type { Event } from "@/db/schema";
import {
  countEventsByListFilter,
  filterEventsByListFilter,
  type EventListFilter,
  getEventListFilter,
} from "@/lib/event-dashboard";
import { getEventFormatLabel } from "@/lib/event-formats";
import { cn } from "@/lib/utils";

const FILTERS: { id: EventListFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "drafts", label: "Drafts" },
  { id: "past", label: "Past" },
];

function formatFee(cents: number) {
  if (cents === 0) return "Free entry";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)} entry`;
}

function DateTile({ dateStr }: { dateStr: string }) {
  const date = new Date(`${dateStr}T12:00:00`);
  const month = date
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  const day = date.toLocaleDateString("en-US", { day: "numeric" });
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <div className="flex w-14 shrink-0 flex-col items-center rounded-xl border border-border/70 bg-background py-1.5 leading-tight">
      <span className="text-[10px] font-semibold tracking-widest text-primary">
        {month}
      </span>
      <span className="font-heading text-xl font-semibold tabular-nums">
        {day}
      </span>
      <span className="text-[10px] text-muted-foreground">{weekday}</span>
    </div>
  );
}

function StatusIndicator({ event }: { event: Event }) {
  if (event.scoringStatus === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        Live
      </span>
    );
  }

  if (event.scoringStatus === "finalized") {
    return (
      <span className="text-sm font-medium text-muted-foreground">
        Complete
      </span>
    );
  }

  if (event.status === "draft") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <span className="size-2 rounded-full border border-muted-foreground/40" />
        Draft
      </span>
    );
  }

  if (getEventListFilter(event) === "past") {
    return (
      <span className="text-sm font-medium text-muted-foreground">Ended</span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
      <span className="size-2 rounded-full bg-primary/70" />
      Scheduled
    </span>
  );
}

function CapacityMeter({
  count,
  max,
}: {
  count: number;
  max: number;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0;

  return (
    <div className="w-full max-w-36">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium tabular-nums">{count}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          of {max}
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

type EventsListProps = {
  events: Event[];
  registrationCounts: Record<string, number>;
  preview?: boolean;
  activeFilter?: EventListFilter;
};

export function EventsList({
  events,
  registrationCounts,
  preview = false,
  activeFilter: activeFilterProp = "all",
}: EventsListProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedFilter = searchParams.get("filter") as EventListFilter | null;
  const activeFilter = preview
    ? activeFilterProp
    : FILTERS.some((filter) => filter.id === requestedFilter)
      ? (requestedFilter as EventListFilter)
      : "all";

  const counts = countEventsByListFilter(events);
  const visibleEvents = filterEventsByListFilter(events, activeFilter);

  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          const pillClassName = cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200",
            isActive
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          );

          if (preview) {
            return (
              <span key={filter.id} className={pillClassName}>
                {filter.label}
                {counts[filter.id] > 0 && (
                  <span
                    className={cn(
                      "ml-1.5 text-xs tabular-nums",
                      isActive ? "text-muted-foreground" : "text-muted-foreground/70"
                    )}
                  >
                    {counts[filter.id]}
                  </span>
                )}
              </span>
            );
          }

          return (
            <Link
              key={filter.id}
              href={
                filter.id === "all" ? pathname : `${pathname}?filter=${filter.id}`
              }
              className={pillClassName}
            >
              {filter.label}
              {counts[filter.id] > 0 && (
                <span
                  className={cn(
                    "ml-1.5 text-xs tabular-nums",
                    isActive ? "text-muted-foreground" : "text-muted-foreground/70"
                  )}
                >
                  {counts[filter.id]}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {visibleEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
          <p className="font-heading text-lg font-medium">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {activeFilter === "drafts"
              ? "Drafts you're still setting up will appear here."
              : activeFilter === "past"
                ? "Finished events will appear here after event day."
                : "Create an event to see it here."}
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-card">
          {visibleEvents.map((event, index) => {
            const registrationCount = registrationCounts[event.id] ?? 0;
            const rowContent = (
              <>
                <DateTile dateStr={event.date} />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-snug">
                    {event.name}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {event.courseName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                    {getEventFormatLabel(event.format)} · {event.holes} holes ·{" "}
                    {formatFee(event.entryFeeCents)}
                  </p>
                </div>

                <div className="hidden sm:block">
                  {event.status === "published" ? (
                    <CapacityMeter
                      count={registrationCount}
                      max={event.maxPlayers}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Up to {event.maxPlayers} players
                    </span>
                  )}
                </div>

                <div className="hidden w-24 justify-end sm:flex">
                  <StatusIndicator event={event} />
                </div>

                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </>
            );

            return (
              <li
                key={event.id}
                className={cn(index > 0 && "border-t border-border/70")}
              >
                {preview ? (
                  <div className="group flex items-center gap-4 px-4 py-4 sm:px-6">
                    {rowContent}
                  </div>
                ) : (
                  <Link
                    href={`/dashboard/events/${event.id}`}
                    className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-6"
                  >
                    {rowContent}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
