"use client";

import { useEffect, useRef } from "react";

import {
  DRAFT_EVENT_TABS,
  PUBLISHED_EVENT_TABS,
  type EventTab,
} from "@/lib/event-dashboard";
import { cn } from "@/lib/utils";

type EventDetailTabsProps = {
  activeTab: EventTab;
  onTabChange: (tab: EventTab) => void;
  isDraft: boolean;
};

export function EventDetailTabs({
  activeTab,
  onTabChange,
  isDraft,
}: EventDetailTabsProps) {
  const tabs = isDraft ? DRAFT_EVENT_TABS : PUBLISHED_EVENT_TABS;
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<EventTab, HTMLButtonElement>());

  useEffect(() => {
    const activeButton = tabRefs.current.get(activeTab);
    if (!activeButton || !scrollRef.current) return;

    const container = scrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const offset =
      buttonRect.left -
      containerRect.left -
      (containerRect.width - buttonRect.width) / 2;

    container.scrollTo({
      left: container.scrollLeft + offset,
      behavior: "smooth",
    });
  }, [activeTab]);

  return (
    <nav aria-label="Event sections" className="relative min-w-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-linear-to-r from-background to-transparent sm:w-8 md:hidden"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-linear-to-l from-background to-transparent sm:w-8 md:hidden"
      />

      <div
        ref={scrollRef}
        className={cn(
          "flex min-w-0 border-b border-border",
          "overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden",
          "snap-x snap-mandatory touch-pan-x",
          "md:snap-none md:overflow-visible"
        )}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const mobileLabel = tab.shortLabel ?? tab.label;

          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(tab.id, node);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative shrink-0 snap-start border-b-2 px-3.5 py-3 text-sm font-medium transition-colors",
                "min-h-11 touch-manipulation whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "md:flex-1 md:px-2 md:text-center lg:px-4",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <span className="md:hidden">{mobileLabel}</span>
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
