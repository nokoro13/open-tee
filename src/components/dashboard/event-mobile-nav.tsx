"use client";

import {
  BarChart3,
  ClipboardList,
  LayoutGrid,
  Rocket,
  Settings2,
  Trophy,
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
  scoring: Trophy,
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
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
    >
      <div className="flex items-stretch justify-around">
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
                "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="max-w-full truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
