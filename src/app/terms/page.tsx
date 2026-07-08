import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { termsSections } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Terms of Service — OpenRound",
  description: "Terms of Service for using OpenRound golf tournament software.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      description="These terms apply to organizers, players, volunteers, and anyone using OpenRound."
      sections={termsSections}
    />
  );
}
