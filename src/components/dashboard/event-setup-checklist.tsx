import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  eventTabHref,
  getEventSetupChecklist,
  type SetupChecklistItem,
} from "@/lib/event-dashboard";
import type { Event } from "@/db/schema";
import type { EventPairings } from "@/lib/pairings";

type EventSetupChecklistProps = {
  eventId: string;
  registrationCount: number;
  maxPlayers: number;
  pairings: EventPairings | null;
  scoringStatus: Event["scoringStatus"];
};

function ChecklistRow({
  eventId,
  step,
  isNext,
}: {
  eventId: string;
  step: SetupChecklistItem;
  isNext: boolean;
}) {
  const Icon = step.done ? CheckCircle2 : Circle;

  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
        isNext ? "border-primary/30 bg-primary/5" : "border-border/60"
      }`}
    >
      <div className="flex min-w-0 gap-3">
        <Icon
          className={`mt-0.5 size-5 shrink-0 ${
            step.done ? "text-primary" : "text-muted-foreground/50"
          }`}
          aria-hidden
        />
        <div className="min-w-0">
          <p
            className={`text-sm font-medium ${
              step.done ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {step.label}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
        </div>
      </div>
      {isNext && step.tab !== "overview" && (
        <ButtonLink
          href={step.href ?? eventTabHref(eventId, step.tab)}
          size="sm"
          className="shrink-0"
          {...(step.href
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {step.href ? "Print" : "Go"}
          <ArrowRight />
        </ButtonLink>
      )}
    </div>
  );
}

export function EventSetupChecklist({
  eventId,
  registrationCount,
  maxPlayers,
  pairings,
  scoringStatus,
}: EventSetupChecklistProps) {
  const steps = getEventSetupChecklist({
    eventId,
    registrationCount,
    maxPlayers,
    pairings,
    scoringStatus,
  });

  const nextStep = steps.find((step) => !step.done);
  const completedCount = steps.filter((step) => step.done).length;

  if (!nextStep) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Tournament setup</CardTitle>
        <CardDescription>
          {completedCount} of {steps.length} complete
          {nextStep ? ` — next: ${nextStep.label.toLowerCase()}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <ChecklistRow
            key={step.id}
            eventId={eventId}
            step={step}
            isNext={step.id === nextStep.id}
          />
        ))}
      </CardContent>
    </Card>
  );
}
