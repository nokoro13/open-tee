"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type EventCreationStep = {
  id: string;
  label: string;
};

type EventCreationStepperProps = {
  steps: EventCreationStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
};

export function EventCreationStepper({
  steps,
  currentStepIndex,
  onStepClick,
}: EventCreationStepperProps) {
  const currentStep = steps[currentStepIndex];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium text-foreground">
          Step {currentStepIndex + 1} of {steps.length}
        </p>
        <p className="truncate text-muted-foreground">{currentStep?.label}</p>
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={currentStepIndex + 1}
        aria-label={`Step ${currentStepIndex + 1} of ${steps.length}: ${currentStep?.label ?? ""}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{
            width: `${((currentStepIndex + 1) / steps.length) * 100}%`,
          }}
        />
      </div>

      {/* Mobile: compact progress dots — no horizontal scroll */}
      <div
        className="flex items-center justify-center gap-1.5 sm:hidden"
        aria-hidden
      >
        {steps.map((step, index) => {
          const isComplete = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div
              key={step.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                isCurrent && "w-6 bg-primary",
                isComplete && !isCurrent && "w-1.5 bg-primary/70",
                !isCurrent && !isComplete && "w-1.5 bg-muted-foreground/25"
              )}
            />
          );
        })}
      </div>

      {/* Desktop: full step pills */}
      <nav
        aria-label="Event setup progress"
        className="hidden sm:block"
      >
        <ol className="flex flex-wrap gap-2">
          {steps.map((step, index) => {
            const isComplete = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isClickable = onStepClick && index <= currentStepIndex;

            return (
              <li key={step.id}>
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick(index)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                    isCurrent &&
                      "border-primary bg-primary/10 font-medium text-primary",
                    isComplete &&
                      !isCurrent &&
                      "border-primary/30 bg-primary/5 text-foreground",
                    !isCurrent &&
                      !isComplete &&
                      "border-border bg-background text-muted-foreground",
                    isClickable && "hover:border-primary/40 hover:bg-muted/60",
                    !isClickable && "cursor-default"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isCurrent && "bg-primary text-primary-foreground",
                      isComplete &&
                        !isCurrent &&
                        "bg-primary text-primary-foreground",
                      !isCurrent &&
                        !isComplete &&
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {isComplete && !isCurrent ? (
                      <Check className="size-3" aria-hidden />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span>{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
