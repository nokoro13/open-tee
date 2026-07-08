import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { privacySections } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy — OpenRound",
  description: "How OpenRound collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="This policy describes how we handle personal information on OpenRound."
      sections={privacySections}
    />
  );
}
