import { notFound } from "next/navigation";

import { PrintScorecardShell } from "@/components/dashboard/print-scorecard-shell";
import { PrintableScorecardSheet } from "@/components/dashboard/printable-scorecard-sheet";
import { requireOrganization } from "@/lib/auth";
import { getPrintableScorecardBundle } from "@/lib/printable-scorecard";
import { generateQrDataUrl } from "@/lib/qr-code";
import { getAppUrl } from "@/lib/stripe";

type GroupScorecardPageProps = {
  params: Promise<{ id: string; groupId: string }>;
};

export default async function GroupScorecardPage({
  params,
}: GroupScorecardPageProps) {
  const { id, groupId } = await params;
  const org = await requireOrganization();
  const bundle = await getPrintableScorecardBundle(id, org.id, getAppUrl(), {
    groupId,
  });

  if (!bundle || bundle.scorecards.length === 0) {
    notFound();
  }

  const scorecard = bundle.scorecards[0];
  const qrDataUrl = await generateQrDataUrl(scorecard.scoringUrl);

  return (
    <PrintScorecardShell eventId={id}>
      <PrintableScorecardSheet
        event={bundle.event}
        scorecard={scorecard}
        qrDataUrl={qrDataUrl}
      />
    </PrintScorecardShell>
  );
}
