import type { Event } from "@/db/schema";
import type { EventPairings } from "@/lib/pairings";

export type EventListFilter = "all" | "drafts" | "upcoming" | "past";

export type PublishedEventTab =
  | "overview"
  | "players"
  | "pairings"
  | "scoring"
  | "settings";

export type DraftEventTab = "details" | "publish";

export type EventTab = PublishedEventTab | DraftEventTab;

export const PUBLISHED_EVENT_TABS: { id: PublishedEventTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "players", label: "Players" },
  { id: "pairings", label: "Pairings" },
  { id: "scoring", label: "Scoring" },
  { id: "settings", label: "Settings" },
];

export const DRAFT_EVENT_TABS: { id: DraftEventTab; label: string }[] = [
  { id: "details", label: "Event details" },
  { id: "publish", label: "Publish" },
];

const PUBLISHED_TAB_SET = new Set<string>(PUBLISHED_EVENT_TABS.map((tab) => tab.id));
const DRAFT_TAB_SET = new Set<string>(DRAFT_EVENT_TABS.map((tab) => tab.id));

export function parseEventTab(
  tab: string | undefined,
  isDraft: boolean
): EventTab {
  if (isDraft) {
    return tab && DRAFT_TAB_SET.has(tab) ? (tab as DraftEventTab) : "details";
  }

  return tab && PUBLISHED_TAB_SET.has(tab)
    ? (tab as PublishedEventTab)
    : "overview";
}

export function eventTabHref(eventId: string, tab: EventTab): string {
  return `/dashboard/events/${eventId}?tab=${tab}`;
}

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getEventListFilter(event: Event): Exclude<EventListFilter, "all"> {
  if (event.status === "draft") return "drafts";

  const today = todayDateString();
  if (
    event.status === "closed" ||
    event.status === "archived" ||
    event.scoringStatus === "finalized" ||
    event.date < today
  ) {
    return "past";
  }

  return "upcoming";
}

export function filterEventsByListFilter(
  events: Event[],
  filter: EventListFilter
): Event[] {
  if (filter === "all") return events;
  return events.filter((event) => getEventListFilter(event) === filter);
}

export function countEventsByListFilter(events: Event[]): Record<EventListFilter, number> {
  return events.reduce(
    (counts, event) => {
      counts.all += 1;
      counts[getEventListFilter(event)] += 1;
      return counts;
    },
    { all: 0, drafts: 0, upcoming: 0, past: 0 }
  );
}

export type SetupStep = {
  label: string;
  description: string;
  tab: EventTab;
};

export function getCurrentSetupStep(options: {
  isDraft: boolean;
  registrationCount: number;
  pairings: EventPairings | null;
  scoringStatus: Event["scoringStatus"];
}): SetupStep | null {
  const { isDraft, registrationCount, pairings, scoringStatus } = options;

  if (isDraft) {
    return {
      label: "Publish your event",
      description: "Pay the platform fee to open registration and share your event link.",
      tab: "publish",
    };
  }

  if (scoringStatus === "finalized") return null;

  if (registrationCount === 0) {
    return {
      label: "Share the registration link",
      description: "Send your public signup page to players.",
      tab: "overview",
    };
  }

  const pairingsReady =
    pairings != null &&
    pairings.groups.length > 0 &&
    pairings.unassigned.length === 0;

  if (!pairingsReady) {
    return {
      label: "Build pairings",
      description: "Assign registered players to groups and print scorecards.",
      tab: "pairings",
    };
  }

  if (scoringStatus === "disabled") {
    return {
      label: "Open scoring",
      description: "Send scoring links when groups are on the course.",
      tab: "scoring",
    };
  }

  if (scoringStatus === "open") {
    return {
      label: "Finalize results",
      description: "Lock scores and publish the final leaderboard.",
      tab: "scoring",
    };
  }

  return null;
}

export function getScoringStatusLabel(
  scoringStatus: Event["scoringStatus"]
): string | null {
  if (scoringStatus === "open") return "Scoring live";
  if (scoringStatus === "finalized") return "Complete";
  return null;
}

export function getDaysUntilEvent(dateStr: string): number {
  const today = new Date(`${todayDateString()}T00:00:00`);
  const eventDate = new Date(`${dateStr}T00:00:00`);
  return Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
}

export function formatDaysUntilEvent(dateStr: string): {
  value: string;
  caption: string;
} {
  const days = getDaysUntilEvent(dateStr);
  if (days === 0) return { value: "Today", caption: "Event day" };
  if (days === 1) return { value: "Tomorrow", caption: "1 day to go" };
  if (days > 1) return { value: `${days} days`, caption: "Until event day" };
  if (days === -1) return { value: "Yesterday", caption: "Event finished" };
  return { value: `${Math.abs(days)} days ago`, caption: "Event finished" };
}

export function formatEventListDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatEventHeaderDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
