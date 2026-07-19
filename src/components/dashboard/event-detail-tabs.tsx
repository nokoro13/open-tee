"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DRAFT_EVENT_TABS,
  PUBLISHED_EVENT_TABS,
  type EventTab,
} from "@/lib/event-dashboard";
import { cn } from "@/lib/utils";

type EventDetailTabsProps = {
  eventId: string;
  activeTab: EventTab;
  isDraft: boolean;
};

export function EventDetailTabs({
  activeTab,
  isDraft,
}: EventDetailTabsProps) {
  const pathname = usePathname();
  const tabs = isDraft ? DRAFT_EVENT_TABS : PUBLISHED_EVENT_TABS;

  return (
    <nav
      aria-label="Event sections"
      className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <Link
            key={tab.id}
            href={`${pathname}?tab=${tab.id}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
