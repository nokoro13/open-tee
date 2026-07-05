import { EventForm } from "@/components/dashboard/event-form";
import { PreviewBrowserFrame } from "@/components/landing/preview-browser-frame";
import { PreviewDashboardShell } from "@/components/landing/preview-dashboard-shell";
import {
  DESKTOP_NATIVE_WIDTH,
  PreviewScale,
} from "@/components/landing/preview-scale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getEventFormatLabel } from "@/lib/event-formats";
import {
  previewDraftEvent,
  previewDraftEventHoles,
} from "@/lib/landing-preview-data";

const NATIVE_HEIGHT = 720;

export function EventSetupPreview() {
  const draftEvent = {
    ...previewDraftEvent,
    eventHoles: previewDraftEventHoles,
  };

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
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  New {getEventFormatLabel(previewDraftEvent.format)} event
                </h1>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  Set up a draft tournament. You can change the format anytime
                  while editing.
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Event details</CardTitle>
                  <CardDescription>
                    Starting with {getEventFormatLabel(previewDraftEvent.format)}.
                    You can edit this anytime while the event is in draft.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EventForm event={draftEvent} />
                </CardContent>
              </Card>
            </div>
          </PreviewDashboardShell>
        </div>
      </PreviewScale>
    </PreviewBrowserFrame>
  );
}
