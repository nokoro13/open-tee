"use client";

import {
  BarChart3,
  ClipboardList,
  LayoutGrid,
  Rocket,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  DRAFT_EVENT_TABS,
  PUBLISHED_EVENT_TABS,
  type EventTab,
} from "@/lib/event-dashboard";
import { cn } from "@/lib/utils";

export const EVENT_TAB_ICONS: Record<EventTab, LucideIcon> = {
  players: Users,
  pairings: LayoutGrid,
  analytics: BarChart3,
  settings: Settings2,
  details: ClipboardList,
  publish: Rocket,
};

type EventMobileNavProps = {
  isDraft: boolean;
  activeTab: EventTab;
  onTabChange: (tab: EventTab) => void;
};

export function EventMobileNav({
  isDraft,
  activeTab,
  onTabChange,
}: EventMobileNavProps) {
  const tabs = isDraft ? DRAFT_EVENT_TABS : PUBLISHED_EVENT_TABS;

  return (
    <nav
      aria-label="Event sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-lg md:hidden"
    >
      <div className="flex items-stretch justify-around px-2">
        {tabs.map((tab) => {
          const Icon = EVENT_TAB_ICONS[tab.id];
          const isActive = activeTab === tab.id;
          const label = tab.shortLabel ?? tab.label;

          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex min-h-12.25 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium touch-manipulation transition-opacity active:opacity-60",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn("size-5.5 shrink-0", isActive && "stroke-[2.25]")}
                aria-hidden
              />
              <span className="max-w-full truncate leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
