import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireUserId } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await requireUserId();

  return (
    <TooltipProvider>
      <DashboardShell showAdminNav={isPlatformAdmin(userId)}>
        {children}
      </DashboardShell>
    </TooltipProvider>
  );
}
