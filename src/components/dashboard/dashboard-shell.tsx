"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import {
  SidebarInset,
  SidebarMobileTrigger,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { isEventWorkspacePath } from "@/lib/event-dashboard";

type DashboardShellProps = {
  children: React.ReactNode;
  showAdminNav?: boolean;
};

function SidebarFallback() {
  return null;
}

function AppDashboardChrome({
  children,
  showAdminNav,
}: {
  children: React.ReactNode;
  showAdminNav: boolean;
}) {
  return (
    <>
      <Suspense fallback={<SidebarFallback />}>
        <AppSidebar showAdminNav={showAdminNav} />
      </Suspense>
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
          <SidebarMobileTrigger className="-ml-1 self-start md:hidden" />
          {children}
        </div>
      </SidebarInset>
    </>
  );
}

export function DashboardShell({
  children,
  showAdminNav = false,
}: DashboardShellProps) {
  const pathname = usePathname();
  const isEventWorkspace = isEventWorkspacePath(pathname);

  return (
    <SidebarProvider defaultOpen>
      {isEventWorkspace ? (
        children
      ) : (
        <AppDashboardChrome showAdminNav={showAdminNav}>
          {children}
        </AppDashboardChrome>
      )}
    </SidebarProvider>
  );
}
