import { LeaderboardView } from "@/components/public/leaderboard-view";
import { PreviewBrowserFrame } from "@/components/landing/preview-browser-frame";
import { PreviewScale } from "@/components/landing/preview-scale";
import { previewLeaderboardPayload } from "@/lib/landing-preview-data";

const NATIVE_WIDTH = 480;
const NATIVE_HEIGHT = 620;

export function LeaderboardPreview() {
  return (
    <PreviewBrowserFrame url="openround.app/e/spring-charity-scramble/leaderboard">
      <PreviewScale
        nativeWidth={NATIVE_WIDTH}
        nativeHeight={NATIVE_HEIGHT}
        interactive
      >
        <div
          className="h-[620px] overflow-hidden bg-background"
          style={{ width: NATIVE_WIDTH }}
        >
          <LeaderboardView
            slug={previewLeaderboardPayload.event.slug}
            initialData={previewLeaderboardPayload}
            pollIntervalMs={0}
            embed
          />
        </div>
      </PreviewScale>
    </PreviewBrowserFrame>
  );
}
