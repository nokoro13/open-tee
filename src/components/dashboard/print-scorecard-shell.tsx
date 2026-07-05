"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

type PrintScorecardShellProps = {
  eventId: string;
  children: React.ReactNode;
};

export function PrintScorecardShell({
  eventId,
  children,
}: PrintScorecardShellProps) {
  return (
    <div className="print-scorecard-shell mx-auto w-full max-w-[10.5in] px-3 sm:px-4 print:max-w-none print:px-0">
      <div className="print-scorecard-toolbar mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            variant="outline"
            size="sm"
            href={`/dashboard/events/${eventId}`}
          >
            Back to event
          </ButtonLink>
          <Button type="button" size="sm" onClick={() => window.print()}>
            <Printer />
            Print scorecards
          </Button>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">
          What you see below is what will print. On mobile, swipe the scorecard
          to preview the full layout. Use landscape and turn off browser
          headers/footers when printing.
        </p>
      </div>

      <div className="print-scorecard-stack flex flex-col items-stretch gap-8 print:gap-0">
        {children}
      </div>
    </div>
  );
}
