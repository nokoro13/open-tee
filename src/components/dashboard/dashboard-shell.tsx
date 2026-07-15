"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getEventFormat } from "@/lib/event-formats";

type DashboardShellProps = {
  children: React.ReactNode;
  showAdminNav?: boolean;
};

function SidebarFallback() {
  return null;
}

function DashboardHeaderTitle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname === "/dashboard") {
    return "Home";
  }

  if (pathname.startsWith("/dashboard/courses")) {
    return "Verified courses";
  }

  if (pathname.startsWith("/dashboard/admin/courses")) {
    return "Course verification";
  }

  if (pathname === "/dashboard/settings") {
    return "Organization";
  }

  if (pathname === "/dashboard/events/new") {
    const format = searchParams.get("format");
    const formatMeta = format ? getEventFormat(format) : undefined;
    return formatMeta ? `New ${formatMeta.label}` : "New event";
  }

  if (pathname.startsWith("/dashboard/events/")) {
    return "Event";
  }

  return "Dashboard";
}

export function DashboardShell({
  children,
  showAdminNav = false,
}: DashboardShellProps) {
  return (
    <SidebarProvider defaultOpen>
      <Suspense fallback={<SidebarFallback />}>
        <AppSidebar showAdminNav={showAdminNav} />
      </Suspense>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 sm:h-16 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <div className="flex flex-1 items-center">
            <Suspense
              fallback={<p className="text-sm text-muted-foreground">Dashboard</p>}
            >
              <p className="text-sm font-medium text-foreground">
                <DashboardHeaderTitle />
              </p>
            </Suspense>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
