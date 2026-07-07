import { EventCreationWizard } from "@/components/dashboard/event-creation-wizard";
import { PreviewBrowserFrame } from "@/components/landing/preview-browser-frame";
import { PreviewDashboardShell } from "@/components/landing/preview-dashboard-shell";
import {
  DESKTOP_NATIVE_WIDTH,
  PreviewScale,
} from "@/components/landing/preview-scale";
import { getEventFormatLabel } from "@/lib/event-formats";
import { previewDraftEvent } from "@/lib/landing-preview-data";

const NATIVE_HEIGHT = 720;

export function EventSetupPreview() {
  return (
    <PreviewBrowserFrame url="openround.app/dashboard/events/new?format=best_ball">
      <PreviewScale
        nativeWidth={DESKTOP_NATIVE_WIDTH}
        nativeHeight={NATIVE_HEIGHT}
      >
        <div className="h-[720px] overflow-hidden bg-background">
          <PreviewDashboardShell
            title={`New ${getEventFormatLabel(previewDraftEvent.format)} event`}
            activePath="/dashboard/events/new"
          >
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  New {getEventFormatLabel(previewDraftEvent.format)} event
                </h1>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  Set up your event step by step. You can change anything while
                  it&apos;s in draft.
                </p>
              </div>

              <EventCreationWizard defaultFormat={previewDraftEvent.format} />
            </div>
          </PreviewDashboardShell>
        </div>
      </PreviewScale>
    </PreviewBrowserFrame>
  );
}
