"use client";

import { UserButton } from "@clerk/nextjs";
import {
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  Trophy,
} from "lucide-react";
import Link from "next/link";

import type { Event } from "@/db/schema";
import { EVENT_TAB_ICONS } from "@/components/dashboard/event-mobile-nav";
import { EventStatusBadge } from "@/components/dashboard/event-status-badge";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DRAFT_EVENT_TABS,
  PUBLISHED_EVENT_TABS,
  formatEventListDate,
  type EventTab,
} from "@/lib/event-dashboard";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarCollapseTrigger,
  SidebarExpandTrigger,
  SidebarHeaderActions,
} from "@/components/ui/sidebar";

export type EventSidebarEvent = Pick<
  Event,
  | "id"
  | "name"
  | "slug"
  | "status"
  | "scoringStatus"
  | "courseName"
  | "date"
>;

type EventSidebarProps = {
  event: EventSidebarEvent;
  isDraft: boolean;
  activeTab: EventTab;
  onTabChange: (tab: EventTab) => void;
};

export function EventSidebar({
  event,
  isDraft,
  activeTab,
  onTabChange,
}: EventSidebarProps) {
  const isMobile = useIsMobile();
  const tabs = isDraft ? DRAFT_EVENT_TABS : PUBLISHED_EVENT_TABS;
  const showPublicLinks = !isDraft;

  if (isMobile) {
    return null;
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarHeaderActions>
          <SidebarMenu className="min-w-0 flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/dashboard" />}
                tooltip="Back to Events"
              >
                <ArrowLeft />
                <span>Events</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarCollapseTrigger />
        </SidebarHeaderActions>

        <div className="min-w-0 space-y-1.5 px-2 py-1 group-data-[collapsible=icon]:hidden">
          <p className="truncate font-heading text-sm font-semibold tracking-tight">
            {event.name}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/70">
            {event.courseName} · {formatEventListDate(event.date)}
          </p>
          <EventStatusBadge event={event} size="sm" className="shrink-0" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tabs.map((tab) => {
                const Icon = EVENT_TAB_ICONS[tab.id];
                return (
                  <SidebarMenuItem key={tab.id}>
                    <SidebarMenuButton
                      isActive={activeTab === tab.id}
                      tooltip={tab.label}
                      onClick={() => onTabChange(tab.id)}
                    >
                      <Icon />
                      <span>{tab.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showPublicLinks && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Public</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link
                          href={`/e/${event.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                      tooltip="Event page"
                    >
                      <ExternalLink />
                      <span>Event page</span>
                      <ArrowUpRight className="ml-auto size-3.5 opacity-60 group-data-[collapsible=icon]:hidden" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {(event.scoringStatus === "open" ||
                    event.scoringStatus === "finalized") && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link
                            href={`/e/${event.slug}/leaderboard`}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                        tooltip="Leaderboard"
                      >
                        <Trophy />
                        <span>Leaderboard</span>
                        <ArrowUpRight className="ml-auto size-3.5 opacity-60 group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarExpandTrigger />
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:justify-center">
              <UserButton />
              <span className="truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
                Account
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
