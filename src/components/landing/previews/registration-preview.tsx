import { PublicEventView } from "@/components/public/public-event-view";
import { PreviewBrowserFrame } from "@/components/landing/preview-browser-frame";
import { PreviewScale } from "@/components/landing/preview-scale";
import { previewRegistrationEvent } from "@/lib/landing-preview-data";

const NATIVE_WIDTH = 480;
const NATIVE_HEIGHT = 720;

export function RegistrationPreview() {
  const { event, organization, registrationCount, spotsLeft, soldOut, registrationClosed } =
    previewRegistrationEvent;

  return (
    <PreviewBrowserFrame url="openround.app/e/spring-charity-scramble">
      <PreviewScale nativeWidth={NATIVE_WIDTH} nativeHeight={NATIVE_HEIGHT}>
        <div
          className="h-[720px] overflow-hidden bg-background"
          style={{ width: NATIVE_WIDTH }}
        >
          <PublicEventView
            event={{ ...event, organization }}
            registrationCount={registrationCount}
            spotsLeft={spotsLeft}
            soldOut={soldOut}
            registrationClosed={registrationClosed}
            demoMode
          />
        </div>
      </PreviewScale>
    </PreviewBrowserFrame>
  );
}
