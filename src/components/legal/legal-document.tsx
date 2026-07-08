import Link from "next/link";
import { Flag } from "lucide-react";

import type { LegalSection } from "@/lib/legal-content";
import { LEGAL_LAST_UPDATED } from "@/lib/legal-content";

type LegalDocumentProps = {
  title: string;
  description: string;
  sections: LegalSection[];
};

export function LegalDocument({
  title,
  description,
  sections,
}: LegalDocumentProps) {
  return (
    <div className="min-h-full bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4 sm:h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Flag className="size-4" />
            </div>
            <span className="font-heading text-base font-semibold">OpenRound</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {LEGAL_LAST_UPDATED}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">
            Back to OpenRound
          </Link>
        </p>
      </main>
    </div>
  );
}
