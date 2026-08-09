"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  EventSidebar,
  type EventSidebarEvent,
} from "@/components/dashboard/event-sidebar";
import { EventMobileNav } from "@/components/dashboard/event-mobile-nav";
import { ButtonLink } from "@/components/ui/button-link";
import { SidebarInset } from "@/components/ui/sidebar";
import { parseEventTab, type EventTab } from "@/lib/event-dashboard";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

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
  children: ReactNode;
};

export function EventDetailView({
  initialTab,
  isDraft,
  event,
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
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-5 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:gap-6 sm:p-6 md:pb-6">
          <div className="flex items-center gap-2 md:hidden">
            <ButtonLink
              href="/dashboard"
              variant="ghost"
              size="icon-sm"
              aria-label="Back to Events"
              className="-ml-1 shrink-0"
            >
              <ArrowLeft />
            </ButtonLink>
            <p className="min-w-0 truncate text-sm font-medium text-foreground">
              {event.name}
            </p>
          </div>
          <div className="mx-auto w-full min-w-0 space-y-5 sm:space-y-6">
            {children}
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
