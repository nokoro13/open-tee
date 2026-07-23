import { PublicEventView } from "@/components/public/public-event-view";
import { PreviewPhoneFrame } from "@/components/landing/preview-phone-frame";
import { PreviewScale } from "@/components/landing/preview-scale";
import { previewRegistrationEvent } from "@/lib/landing-preview-data";
import {
  PHONE_NATIVE_WIDTH,
  SHOWCASE_SCORE_NATIVE_HEIGHT,
} from "@/lib/showcase-stroke-data";

export function RegistrationPreview() {
  const { event, organization, registrationCount, spotsLeft, soldOut, registrationClosed } =
    previewRegistrationEvent;

  return (
    <PreviewPhoneFrame className="mx-auto w-[15rem] sm:w-[16.5rem] lg:mr-auto lg:w-[18rem]">
      <PreviewScale
        nativeWidth={PHONE_NATIVE_WIDTH}
        nativeHeight={SHOWCASE_SCORE_NATIVE_HEIGHT}
        fit="contain"
        className="h-full w-full"
      >
        <div
          className="overflow-hidden bg-background text-foreground"
          style={{
            width: PHONE_NATIVE_WIDTH,
            height: SHOWCASE_SCORE_NATIVE_HEIGHT,
          }}
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
    </PreviewPhoneFrame>
  );
}
