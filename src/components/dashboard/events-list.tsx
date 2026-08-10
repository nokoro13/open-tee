"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { EventStatusBadge } from "@/components/dashboard/event-status-badge";
import type { Event } from "@/db/schema";
import {
  countEventsByListFilter,
  filterEventsByListFilter,
  type EventListFilter,
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
    <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-muted/60 py-1.5 leading-tight ring-1 ring-foreground/5 sm:w-14">
      <span className="text-[10px] font-semibold tracking-widest text-primary">
        {month}
      </span>
      <span className="font-heading text-lg font-semibold tabular-nums sm:text-xl">
        {day}
      </span>
      <span className="text-[10px] text-muted-foreground">{weekday}</span>
    </div>
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
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium tabular-nums">
          {count}
          <span className="font-normal text-muted-foreground"> / {max}</span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {percent}%
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MobileEventCard({
  event,
  registrationCount,
  href,
  preview = false,
}: {
  event: Event;
  registrationCount: number;
  href: string;
  preview?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <DateTile dateStr={event.date} />
        <EventStatusBadge event={event} size="sm" />
      </div>

      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium leading-snug">{event.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {event.courseName}
        </p>
        <p className="truncate text-xs text-muted-foreground/80">
          {getEventFormatLabel(event.format)} · {event.holes} holes ·{" "}
          {formatFee(event.entryFeeCents)}
        </p>
      </div>

      {event.status === "published" ? (
        <CapacityMeter count={registrationCount} max={event.maxPlayers} />
      ) : (
        <p className="text-xs text-muted-foreground">
          Up to {event.maxPlayers} players
        </p>
      )}

      <div className="flex items-center justify-end text-xs font-medium text-primary">
        Manage
        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </>
  );

  const className =
    "group flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/30 active:bg-muted/40 sm:hidden";

  if (preview) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
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
    <div className="space-y-4">
      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          const pillClassName = cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 sm:px-4",
            isActive
              ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/5"
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
        <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center ring-1 ring-foreground/5">
          <p className="font-heading text-lg font-medium">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
            {activeFilter === "drafts"
              ? "Drafts you're still setting up will appear here."
              : activeFilter === "past"
                ? "Finished events will appear here after event day."
                : "Create an event to see it here."}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: card stack */}
          <ul className="flex flex-col gap-3 sm:hidden">
            {visibleEvents.map((event) => (
              <li key={event.id}>
                <MobileEventCard
                  event={event}
                  registrationCount={registrationCounts[event.id] ?? 0}
                  href={`/dashboard/events/${event.id}`}
                  preview={preview}
                />
              </li>
            ))}
          </ul>

          {/* Desktop: list rows */}
          <ul className="hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 sm:block">
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

                  <div className="hidden w-36 md:block">
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

                  <div className="hidden w-28 justify-end lg:flex">
                    <EventStatusBadge event={event} size="sm" />
                  </div>

                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </>
              );

              return (
                <li
                  key={event.id}
                  className={cn(index > 0 && "border-t border-border/60")}
                >
                  {preview ? (
                    <div className="group flex items-center gap-4 px-5 py-4">
                      {rowContent}
                    </div>
                  ) : (
                    <Link
                      href={`/dashboard/events/${event.id}`}
                      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
                    >
                      {rowContent}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
