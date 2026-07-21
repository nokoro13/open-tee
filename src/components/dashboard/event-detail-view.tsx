"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { EventDetailTabs } from "@/components/dashboard/event-detail-tabs";
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
  children: ReactNode;
};

export function EventDetailView({
  initialTab,
  isDraft,
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
      <div className="min-w-0">
        <div className="sticky top-0 z-20 bg-background/95 pb-px backdrop-blur-sm supports-backdrop-filter:bg-background/80 md:static md:bg-transparent md:backdrop-blur-none">
          <EventDetailTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isDraft={isDraft}
          />
        </div>

        <div className="mt-5 space-y-4 sm:mt-6 sm:space-y-6">{children}</div>
      </div>
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
