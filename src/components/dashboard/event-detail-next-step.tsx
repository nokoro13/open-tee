"use client";

import { ArrowRight } from "lucide-react";

import { useEventDetailTab } from "@/components/dashboard/event-detail-view";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { eventTabHref, type SetupStep } from "@/lib/event-dashboard";

type EventDetailNextStepProps = {
  eventId: string;
  step: SetupStep;
};

export function EventDetailNextStep({ eventId, step }: EventDetailNextStepProps) {
  const { setActiveTab } = useEventDetailTab();

  if (step.href) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            Up next
          </p>
          <p className="mt-1 font-heading text-base font-semibold sm:text-lg">
            {step.label}
          </p>
          <p className="mt-0.5 text-sm opacity-90">{step.description}</p>
        </div>
        <ButtonLink
          href={step.href}
          variant="secondary"
          className="w-full shrink-0 bg-primary-foreground text-primary hover:bg-primary-foreground/90 sm:w-auto"
          target="_blank"
          rel="noopener noreferrer"
        >
          Print
          <ArrowRight />
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">
          Up next
        </p>
        <p className="mt-1 font-heading text-base font-semibold sm:text-lg">
          {step.label}
        </p>
        <p className="mt-0.5 text-sm opacity-90">{step.description}</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full shrink-0 bg-primary-foreground text-primary hover:bg-primary-foreground/90 sm:w-auto"
        onClick={() => setActiveTab(step.tab)}
      >
        Continue
        <ArrowRight />
      </Button>
    </div>
  );
}
