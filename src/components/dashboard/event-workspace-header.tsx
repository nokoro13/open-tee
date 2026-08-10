"use client";

import type { ReactNode } from "react";

import { useEventDetailTab } from "@/components/dashboard/event-detail-view";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import {
  getEventTabDescription,
  getEventTabLabel,
} from "@/lib/event-dashboard";

export function EventWorkspaceHeader({
  isDraft,
  actions,
}: {
  isDraft: boolean;
  actions?: ReactNode;
}) {
  const { activeTab } = useEventDetailTab();
  const title = getEventTabLabel(activeTab, isDraft);
  const description = getEventTabDescription(activeTab, isDraft);

  return (
    <>
      <div className="pb-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 flex-1 truncate font-heading text-xl font-semibold tracking-tight">
            {title}
          </h1>
          {actions && (
            <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
              {actions}
            </div>
          )}
        </div>
      </div>

      <DashboardPageHeader
        title={title}
        description={description}
        actions={actions}
        className="hidden w-full border-b border-border/60 pb-5 md:flex"
      />
    </>
  );
}
