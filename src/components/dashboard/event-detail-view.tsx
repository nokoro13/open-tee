"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft } from "lucide-react";

import {
  EventSidebar,
  type EventSidebarEvent,
} from "@/components/dashboard/event-sidebar";
import { EventMobileNav } from "@/components/dashboard/event-mobile-nav";
import { EventStatusBadge } from "@/components/dashboard/event-status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { SidebarInset } from "@/components/ui/sidebar";
import { parseEventTab, type EventTab } from "@/lib/event-dashboard";
import { cn } from "@/lib/utils";

type EventDetailTabContextValue = {
  activeTab: EventTab;
  setActiveTab: (tab: EventTab) => void;
};

const EventDetailTabContext = createContext<EventDetailTabContextValue | null>(
  null
);

export function useEventDetailTab() {
  const context = useContext(EventDetailTabContext);
  if (!context) {
    throw new Error("useEventDetailTab must be used within EventDetailView");
  }
  return context;
}

type EventDetailViewProps = {
  initialTab: EventTab;
  isDraft: boolean;
  event: EventSidebarEvent;
  header?: ReactNode;
  children: ReactNode;
};

export function EventDetailView({
  initialTab,
  isDraft,
  event,
  header,
  children,
}: EventDetailViewProps) {
  const [activeTab, setActiveTabState] = useState(initialTab);

  const setActiveTab = useCallback((tab: EventTab) => {
    setActiveTabState(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  useEffect(() => {
    function syncTabFromUrl() {
      const params = new URLSearchParams(window.location.search);
      setActiveTabState(parseEventTab(params.get("tab") ?? undefined, isDraft));
    }

    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, [isDraft]);

  return (
    <EventDetailTabContext.Provider value={{ activeTab, setActiveTab }}>
      <EventSidebar
        event={event}
        isDraft={isDraft}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <SidebarInset className="bg-background md:bg-muted/30">
        <div className="pb-[calc(3.25rem+env(safe-area-inset-bottom))] md:pb-0">
          <header className="sticky top-0 z-30 flex items-start gap-2 bg-background/95 px-4 pb-2 pt-4 backdrop-blur-lg md:hidden">
            <ButtonLink
              href="/dashboard"
              variant="ghost"
              size="icon-sm"
              className="-ml-1 shrink-0 self-start touch-manipulation"
              aria-label="Back to Events"
            >
              <ArrowLeft />
            </ButtonLink>
            <div className="flex min-h-7 min-w-0 flex-1 items-center gap-2">
              <p className="truncate text-base font-semibold leading-tight">
                {event.name}
              </p>
              <EventStatusBadge event={event} size="sm" className="shrink-0" />
            </div>
          </header>

          <div className="mx-auto w-full max-w-7xl md:px-6 md:py-8">
            <div className="px-4 pt-4 md:px-0 md:pt-0">{header}</div>
            <div
              className={cn(
                "px-4 pb-4 pt-4 md:px-0 md:pb-0",
                header && "md:pt-6"
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
      <EventMobileNav
        isDraft={isDraft}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </EventDetailTabContext.Provider>
  );
}

type EventTabPanelProps = {
  tab: EventTab;
  children: ReactNode;
  className?: string;
};

export function EventTabPanel({ tab, children, className }: EventTabPanelProps) {
  const { activeTab } = useEventDetailTab();
  const isActive = activeTab === tab;

  return (
    <div
      className={cn(!isActive && "hidden", "min-w-0", className)}
      aria-hidden={!isActive}
      hidden={!isActive}
      data-tab-panel={tab}
    >
      {children}
    </div>
  );
}
