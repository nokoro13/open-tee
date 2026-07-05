"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { PrintableScorecardSheet } from "@/components/dashboard/printable-scorecard-sheet";
import { PreviewBrowserFrame } from "@/components/landing/preview-browser-frame";
import { PreviewScale } from "@/components/landing/preview-scale";
import {
  previewPrintableScorecard,
  previewPrintableScorecardEvent,
} from "@/lib/landing-preview-data";

const NATIVE_WIDTH = 816;
const NATIVE_HEIGHT = 520;

export function PrintableScorecardPreview() {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    void QRCode.toDataURL(previewPrintableScorecard.scoringUrl, {
      margin: 1,
      width: 128,
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl);
  }, []);

  return (
    <PreviewBrowserFrame url="openround.app/print/events/spring-charity-scramble/scorecards">
      <PreviewScale nativeWidth={NATIVE_WIDTH} nativeHeight={NATIVE_HEIGHT}>
        <div
          className="overflow-hidden bg-neutral-100 p-3 sm:p-4"
          style={{ width: NATIVE_WIDTH, height: NATIVE_HEIGHT }}
        >
          {qrDataUrl ? (
            <PrintableScorecardSheet
              event={previewPrintableScorecardEvent}
              scorecard={previewPrintableScorecard}
              qrDataUrl={qrDataUrl}
            />
          ) : (
            <div className="h-full animate-pulse rounded-xl border border-border bg-white" />
          )}
        </div>
      </PreviewScale>
    </PreviewBrowserFrame>
  );
}
