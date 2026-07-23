import { LeaderboardView } from "@/components/public/leaderboard-view";
import { PreviewPhoneFrame } from "@/components/landing/preview-phone-frame";
import { PreviewScale } from "@/components/landing/preview-scale";
import { previewLeaderboardPayload } from "@/lib/landing-preview-data";
import {
  PHONE_NATIVE_WIDTH,
  SHOWCASE_SCORE_NATIVE_HEIGHT,
} from "@/lib/showcase-stroke-data";

export function LeaderboardPreview() {
  return (
    <PreviewPhoneFrame className="mx-auto w-[15rem] sm:w-[16.5rem] lg:ml-auto lg:w-[18rem]">
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
          <LeaderboardView
            slug={previewLeaderboardPayload.event.slug}
            initialData={previewLeaderboardPayload}
            pollIntervalMs={0}
            embed
          />
        </div>
      </PreviewScale>
    </PreviewPhoneFrame>
  );
}
