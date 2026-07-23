import { EventCreationWizard } from "@/components/dashboard/event-creation-wizard";
import { PreviewBrowserFrame } from "@/components/landing/preview-browser-frame";
import { PreviewDashboardShell } from "@/components/landing/preview-dashboard-shell";
import {
  DESKTOP_NATIVE_WIDTH,
  PreviewScale,
} from "@/components/landing/preview-scale";
import { getEventFormat, getEventFormatLabel } from "@/lib/event-formats";
import {
  previewDraftEvent,
  previewEventWizardInitialValues,
} from "@/lib/landing-preview-data";

const NATIVE_HEIGHT = 720;
const formatMeta = getEventFormat(previewDraftEvent.format);

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
            contained
          >
            <div className="mx-auto w-full max-w-5xl min-w-0 space-y-5 pb-2 sm:space-y-6">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
                  New {getEventFormatLabel(previewDraftEvent.format)} event
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {formatMeta?.description ??
                    "Set up your event step by step. You can change anything while it's in draft."}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Starting with {getEventFormatLabel(previewDraftEvent.format)} — change
                  it on the format step if needed.
                </p>
              </div>

              <EventCreationWizard
                defaultFormat={previewDraftEvent.format}
                preview
                initialStepIndex={4}
                initialValues={previewEventWizardInitialValues}
              />
            </div>
          </PreviewDashboardShell>
        </div>
      </PreviewScale>
    </PreviewBrowserFrame>
  );
}
