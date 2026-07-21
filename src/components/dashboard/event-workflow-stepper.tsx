"use client";

import { eventTabHref } from "@/lib/event-dashboard";
import type { EventWorkflowSnapshot } from "@/lib/event-workflow";
import { WORKFLOW_PHASE_LABELS } from "@/lib/event-workflow";
import {
  Stepper,
  StepperDescription,
  StepperHeader,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperMobileDots,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/ui/stepper";

type EventWorkflowStepperProps = {
  eventId: string;
  workflow: EventWorkflowSnapshot;
  compact?: boolean;
};

function getStepState(
  step: EventWorkflowSnapshot["steps"][number],
  index: number,
  currentIndex: number
): "complete" | "current" | "upcoming" {
  if (step.isComplete) return "complete";
  if (step.isCurrent || index === currentIndex) return "current";
  return "upcoming";
}

export function EventWorkflowStepper({
  eventId,
  workflow,
  compact = false,
}: EventWorkflowStepperProps) {
  const currentIndex = Math.max(
    0,
    workflow.steps.findIndex((step) => step.isCurrent)
  );
  const currentStep = workflow.steps[currentIndex] ?? workflow.steps[0];

  return (
    <Stepper
      currentStep={currentIndex}
      totalSteps={workflow.steps.length}
      className={compact ? "space-y-3" : undefined}
    >
      {!compact && (
        <StepperHeader
          title={currentStep?.label}
          description={`${WORKFLOW_PHASE_LABELS[workflow.phase]}. Registration stays open until you close it in Settings or open scoring.`}
        />
      )}

      <StepperMobileDots />

      <StepperList className="hidden sm:flex">
        {workflow.steps.map((step, index) => {
          const state = getStepState(step, index, currentIndex);
          const href = step.href ?? eventTabHref(eventId, step.tab);
          const isLast = index === workflow.steps.length - 1;
          const lineComplete = step.isComplete;

          return (
            <StepperItem key={step.id} step={index + 1} state={state}>
              {!isLast && <StepperSeparator completed={lineComplete} />}
              <StepperTrigger
                href={href}
                {...(step.href
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <StepperIndicator state={state} step={index + 1} />
                <span className="min-w-0">
                  <StepperTitle
                    className={
                      state === "upcoming" ? "text-muted-foreground" : undefined
                    }
                  >
                    {step.label}
                  </StepperTitle>
                  {!compact && (
                    <StepperDescription>{step.description}</StepperDescription>
                  )}
                </span>
              </StepperTrigger>
            </StepperItem>
          );
        })}
      </StepperList>

      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 sm:hidden">
        <p className="text-sm font-medium">{currentStep.label}</p>
        {!compact && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {currentStep.description}
          </p>
        )}
      </div>
    </Stepper>
  );
}
