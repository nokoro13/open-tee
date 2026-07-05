import { notFound } from "next/navigation";

import { PrintScorecardShell } from "@/components/dashboard/print-scorecard-shell";
import { PrintableScorecardSheet } from "@/components/dashboard/printable-scorecard-sheet";
import { requireOrganization } from "@/lib/auth";
import { getPrintableScorecardBundle } from "@/lib/printable-scorecard";
import { generateQrDataUrl } from "@/lib/qr-code";
import { getAppUrl } from "@/lib/stripe";

type ScorecardsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ScorecardsPage({ params }: ScorecardsPageProps) {
  const { id } = await params;
  const org = await requireOrganization();
  const bundle = await getPrintableScorecardBundle(id, org.id, getAppUrl());

  if (!bundle || bundle.scorecards.length === 0) {
    notFound();
  }

  const qrCodes = await Promise.all(
    bundle.scorecards.map((scorecard) => generateQrDataUrl(scorecard.scoringUrl))
  );

  return (
    <PrintScorecardShell eventId={id}>
      {bundle.scorecards.map((scorecard, index) => (
        <PrintableScorecardSheet
          key={scorecard.groupId}
          event={bundle.event}
          scorecard={scorecard}
          qrDataUrl={qrCodes[index]}
        />
      ))}
    </PrintScorecardShell>
  );
}
