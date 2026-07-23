"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { PrintableScorecardSheet } from "@/components/dashboard/printable-scorecard-sheet";
import { PreviewScale } from "@/components/landing/preview-scale";
import {
  previewPrintableScorecard,
  previewPrintableScorecardEvent,
} from "@/lib/landing-preview-data";

/** Letter landscape ratio at preview scale (11″ × 8.5″). */
const LANDSCAPE_WIDTH = 816;
const LANDSCAPE_HEIGHT = 632;

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
    <div className="w-full">
      <PreviewScale nativeWidth={LANDSCAPE_WIDTH} nativeHeight={LANDSCAPE_HEIGHT}>
        <div
          className="overflow-hidden bg-white"
          style={{ width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT }}
        >
          {qrDataUrl ? (
            <PrintableScorecardSheet
              event={previewPrintableScorecardEvent}
              scorecard={previewPrintableScorecard}
              qrDataUrl={qrDataUrl}
            />
          ) : (
            <div className="h-full w-full animate-pulse rounded-xl border border-border bg-white" />
          )}
        </div>
      </PreviewScale>
    </div>
  );
}
