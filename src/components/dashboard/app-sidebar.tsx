"use client";

import { UserButton } from "@clerk/nextjs";
import { Flag } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ADMIN_DASHBOARD_NAV_ITEMS,
  CREATE_FORMAT_SHORTCUTS,
  DASHBOARD_NAV_ITEMS,
} from "@/lib/dashboard-nav";
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
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar({ showAdminNav = false }: { showAdminNav?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const selectedFormat = searchParams.get("format");

  function closeMobileSidebar() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  function isDashboardItemActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname.startsWith(href);
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard" onClick={closeMobileSidebar} />}
              className="data-active:bg-transparent"
            >
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
                    render={
                      <Link href={item.href} onClick={closeMobileSidebar} />
                    }
                    isActive={isDashboardItemActive(item.href)}
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

        {showAdminNav && (
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_DASHBOARD_NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link href={item.href} onClick={closeMobileSidebar} />
                      }
                      isActive={isDashboardItemActive(item.href)}
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
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Create</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      href="/dashboard/events/new"
                      onClick={closeMobileSidebar}
                    />
                  }
                  isActive={pathname === "/dashboard/events/new" && !selectedFormat}
                  tooltip="New event"
                >
                  <Flag />
                  <span>New event</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {CREATE_FORMAT_SHORTCUTS.map((item) => (
                <SidebarMenuItem key={item.format}>
                  <SidebarMenuButton
                    render={
                      <Link href={item.href} onClick={closeMobileSidebar} />
                    }
                    isActive={
                      pathname === "/dashboard/events/new" &&
                      selectedFormat === item.format
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
