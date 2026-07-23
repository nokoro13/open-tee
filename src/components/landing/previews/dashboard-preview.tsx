import { PreviewBrowserFrame } from "@/components/landing/preview-browser-frame";
import { PreviewDashboardShell } from "@/components/landing/preview-dashboard-shell";
import { DashboardPreviewContent } from "@/components/landing/previews/dashboard-preview-content";
import {
  DESKTOP_NATIVE_WIDTH,
  PreviewScale,
} from "@/components/landing/preview-scale";

const NATIVE_HEIGHT = 720;

export function DashboardPreview() {
  return (
    <PreviewBrowserFrame url="openround.app/dashboard">
      <PreviewScale
        nativeWidth={DESKTOP_NATIVE_WIDTH}
        nativeHeight={NATIVE_HEIGHT}
      >
        <div className="h-[720px] overflow-hidden bg-background">
          <PreviewDashboardShell title="Events" contained>
            <DashboardPreviewContent />
          </PreviewDashboardShell>
        </div>
      </PreviewScale>
    </PreviewBrowserFrame>
  );
}
