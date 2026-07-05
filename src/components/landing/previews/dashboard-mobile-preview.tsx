"use client";

import { PreviewDashboardShell } from "@/components/landing/preview-dashboard-shell";
import { PreviewPhoneFrame } from "@/components/landing/preview-phone-frame";
import { PreviewScale } from "@/components/landing/preview-scale";
import { DashboardPreviewContent } from "@/components/landing/previews/dashboard-preview-content";
import {
  PHONE_NATIVE_WIDTH,
  SHOWCASE_SCORE_NATIVE_HEIGHT,
} from "@/lib/showcase-stroke-data";

export function DashboardMobilePreview() {
  return (
    <PreviewPhoneFrame className="mx-auto w-[15rem] sm:w-[16.5rem]">
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
          <PreviewDashboardShell contained title="Home">
            <DashboardPreviewContent />
          </PreviewDashboardShell>
        </div>
      </PreviewScale>
    </PreviewPhoneFrame>
  );
}
