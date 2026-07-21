"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type StepperContextValue = {
  currentStep: number;
  totalSteps: number;
};

const StepperContext = React.createContext<StepperContextValue | null>(null);

function useStepperContext() {
  const context = React.useContext(StepperContext);
  if (!context) {
    throw new Error("Stepper components must be used within Stepper.");
  }
  return context;
}

type StepperProps = React.ComponentProps<"nav"> & {
  currentStep: number;
  totalSteps: number;
};

function Stepper({
  currentStep,
  totalSteps,
  className,
  children,
  ...props
}: StepperProps) {
  return (
    <StepperContext.Provider value={{ currentStep, totalSteps }}>
      <nav
        data-slot="stepper"
        aria-label="Progress"
        className={cn("w-full space-y-4", className)}
        {...props}
      >
        {children}
      </nav>
    </StepperContext.Provider>
  );
}

function StepperHeader({
  className,
  title,
  description,
  ...props
}: React.ComponentProps<"div"> & {
  title?: string;
  description?: string;
}) {
  const { currentStep, totalSteps } = useStepperContext();

  return (
    <div data-slot="stepper-header" className={cn("space-y-3", className)} {...props}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium text-foreground">
          Step {currentStep + 1} of {totalSteps}
        </p>
        {title && <p className="truncate text-muted-foreground">{title}</p>}
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-valuenow={currentStep + 1}
        aria-label={
          title
            ? `Step ${currentStep + 1} of ${totalSteps}: ${title}`
            : `Step ${currentStep + 1} of ${totalSteps}`
        }
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{
            width: `${((currentStep + 1) / totalSteps) * 100}%`,
          }}
        />
      </div>

      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function StepperList({
  className,
  ...props
}: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="stepper-list"
      className={cn("flex w-full items-start", className)}
      {...props}
    />
  );
}

type StepperItemProps = React.ComponentProps<"li"> & {
  step: number;
  state: "complete" | "current" | "upcoming";
};

function StepperItem({
  step,
  state,
  className,
  children,
  ...props
}: StepperItemProps) {
  return (
    <li
      data-slot="stepper-item"
      data-state={state}
      className={cn("relative flex flex-1 flex-col items-center", className)}
      aria-current={state === "current" ? "step" : undefined}
      {...props}
    >
      {children}
    </li>
  );
}

function StepperSeparator({
  completed,
  className,
}: {
  completed?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="stepper-separator"
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-4 left-[calc(50%+1.125rem)] hidden h-0.5 w-[calc(100%-2.25rem)] sm:block",
        completed ? "bg-primary" : "bg-border",
        className
      )}
    />
  );
}

type StepperTriggerProps = React.ComponentProps<"a"> & {
  disabled?: boolean;
};

function StepperTrigger({
  className,
  disabled,
  children,
  ...props
}: StepperTriggerProps) {
  if (disabled) {
    return (
      <div
        data-slot="stepper-trigger"
        className={cn(
          "flex w-full flex-col items-center gap-2 px-1 text-center",
          className
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <a
      data-slot="stepper-trigger"
      className={cn(
        "group flex w-full flex-col items-center gap-2 rounded-xl px-1 py-1 text-center transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}

type StepperIndicatorProps = React.ComponentProps<"span"> & {
  state: "complete" | "current" | "upcoming";
  step: number;
};

function StepperIndicator({
  state,
  step,
  className,
  children,
  ...props
}: StepperIndicatorProps) {
  return (
    <span
      data-slot="stepper-indicator"
      data-state={state}
      className={cn(
        "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
        state === "complete" &&
          "border-primary bg-primary text-primary-foreground",
        state === "current" &&
          "border-primary bg-primary/10 text-primary ring-4 ring-primary/10",
        state === "upcoming" &&
          "border-border bg-background text-muted-foreground",
        className
      )}
      {...props}
    >
      {state === "complete" ? (
        <Check className="size-4" aria-hidden />
      ) : (
        children ?? step
      )}
    </span>
  );
}

function StepperTitle({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stepper-title"
      className={cn("block text-sm font-medium leading-tight", className)}
      {...props}
    />
  );
}

function StepperDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stepper-description"
      className={cn(
        "mt-0.5 hidden max-w-36 text-xs leading-snug text-muted-foreground sm:block",
        className
      )}
      {...props}
    />
  );
}

function StepperMobileDots({ className }: { className?: string }) {
  const { currentStep, totalSteps } = useStepperContext();

  return (
    <div
      data-slot="stepper-mobile-dots"
      className={cn("flex items-center justify-center gap-1.5 sm:hidden", className)}
      aria-hidden
    >
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isComplete = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div
            key={index}
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
  );
}

export {
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
};
