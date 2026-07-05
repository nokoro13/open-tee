"use client";

import { Flag } from "lucide-react";

import {
  CREATE_FORMAT_SHORTCUTS,
  DASHBOARD_NAV_ITEMS,
} from "@/lib/dashboard-nav";
import { Separator } from "@/components/ui/separator";
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
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type PreviewDashboardShellProps = {
  title?: string;
  activePath?: string;
  defaultOpen?: boolean;
  /** Pin shell to a fixed-height preview frame with internal scroll. */
  contained?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function PreviewDashboardShell({
  title = "Home",
  activePath = "/dashboard",
  defaultOpen = true,
  contained = false,
  className,
  children,
}: PreviewDashboardShellProps) {
  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className={cn(contained && "min-h-0! h-full", className)}
    >
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="data-active:bg-transparent">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Flag className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-heading font-semibold tracking-tight">
                    OpenRound
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    Tournament hosting
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {DASHBOARD_NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={activePath === item.href}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Create</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {CREATE_FORMAT_SHORTCUTS.slice(0, 6).map((item) => (
                  <SidebarMenuItem key={item.format}>
                    <SidebarMenuButton
                      isActive={
                        activePath === "/dashboard/events/new" &&
                        item.format === "best_ball"
                      }
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:justify-center">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">OR</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
                  Account
                </span>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset
        className={cn(contained && "min-h-0 overflow-hidden")}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 sm:h-16 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <div className="flex flex-1 items-center">
            <p className="text-sm font-medium text-foreground">{title}</p>
          </div>
        </header>
        <div
          className={cn(
            "flex flex-1 flex-col gap-6 p-4 sm:p-6",
            contained && "min-h-0 overflow-y-auto"
          )}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
