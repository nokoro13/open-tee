import { DashboardMobilePreview } from "@/components/landing/previews/dashboard-mobile-preview";
import { DashboardPreview } from "@/components/landing/previews/dashboard-preview";

export function ResponsiveDashboardPreview() {
  return (
    <>
      <div className="hidden md:block">
        <DashboardPreview />
      </div>
      <div className="md:hidden">
        <DashboardMobilePreview />
      </div>
    </>
  );
}
