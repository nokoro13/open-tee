import { DashboardPreview } from "@/components/landing/previews/dashboard-preview";
import { ScoreShowcasePhone } from "@/components/landing/previews/score-showcase-phone";

export function ResponsiveDashboardPreview() {
  return (
    <>
      <div className="hidden md:block">
        <DashboardPreview />
      </div>
      <div className="md:hidden">
        <ScoreShowcasePhone className="mx-auto w-60 sm:w-66" />
      </div>
    </>
  );
}
