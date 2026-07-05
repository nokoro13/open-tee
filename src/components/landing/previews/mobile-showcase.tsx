"use client";

import { LeaderboardView } from "@/components/public/leaderboard-view";
import { PreviewPhoneFrame } from "@/components/landing/preview-phone-frame";
import { PreviewScale } from "@/components/landing/preview-scale";
import { ScoreShowcasePhone } from "@/components/landing/previews/score-showcase-phone";
import { previewLeaderboardPayload } from "@/lib/landing-preview-data";
import {
  PHONE_NATIVE_WIDTH,
  SHOWCASE_LEADERBOARD_NATIVE_HEIGHT,
} from "@/lib/showcase-stroke-data";
import { cn } from "@/lib/utils";

function LeaderboardPhonePreview({ className }: { className?: string }) {
  return (
    <PreviewPhoneFrame className={className}>
      <PreviewScale
        nativeWidth={PHONE_NATIVE_WIDTH}
        nativeHeight={SHOWCASE_LEADERBOARD_NATIVE_HEIGHT}
        fit="contain"
        className="h-full w-full"
      >
        <div
          className="overflow-hidden bg-background text-foreground"
          style={{
            width: PHONE_NATIVE_WIDTH,
            height: SHOWCASE_LEADERBOARD_NATIVE_HEIGHT,
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

export function MobileShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-[20rem] sm:max-w-none">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(255,255,255,0.14),transparent_70%)]" />

      <div className="relative mx-auto flex min-h-[23rem] items-center justify-center sm:min-h-[27rem] lg:min-h-[29rem]">
        <LeaderboardPhonePreview
          className={cn(
            "absolute right-[-4%] top-10 hidden w-[12.5rem] rotate-[7deg] sm:block",
            "sm:w-[14.5rem] lg:right-[6%] lg:top-6 lg:w-[16.5rem] xl:w-[17.5rem]"
          )}
        />

        <ScoreShowcasePhone
          className={cn(
            "relative z-10 w-[15rem] -rotate-[4deg]",
            "sm:ml-[-6%] sm:w-[16.5rem] lg:w-[18rem] xl:w-[19rem]"
          )}
        />
      </div>
    </div>
  );
}
