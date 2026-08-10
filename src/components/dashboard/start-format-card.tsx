"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, Clock } from "lucide-react";

import { updateEventStartFormat } from "@/actions/start-format";
import {
  defaultStartFormatFieldValues,
  StartFormatFields,
  type StartFormatFieldValues,
} from "@/components/dashboard/start-format-fields";
import { Button } from "@/components/ui/button";
import {
  isEventSetupLocked,
  type EventScoringStatus,
} from "@/lib/event-setup-lock";
import { getStartFormatSummary } from "@/lib/start-format";
import { cn } from "@/lib/utils";

type StartFormatCardProps = {
  eventId: string;
  scoringStatus: EventScoringStatus;
  event: {
    startFormat: "shotgun" | "tee_times";
    shotgunStartTime: string | null;
    firstTeeTime: string | null;
    teeTimeIntervalMinutes: number | null;
  };
};

export function StartFormatCard({
  eventId,
  scoringStatus,
  event,
}: StartFormatCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<StartFormatFieldValues>(() =>
    defaultStartFormatFieldValues(event)
  );
  const setupLocked = isEventSetupLocked(scoringStatus);
  const summary = getStartFormatSummary(event);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateEventStartFormat(eventId, {
        startFormat: values.startFormat,
        shotgunStartTime: values.shotgunStartTime,
        firstTeeTime: values.firstTeeTime,
        teeTimeIntervalMinutes: values.teeTimeIntervalMinutes,
      });

      if (!result.success) {
        setError(result.error ?? "Could not save start settings.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Clock className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold tracking-tight">
              Start schedule
            </p>
            <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
              {summary}
            </p>
            {setupLocked && (
              <p className="mt-1 text-xs text-muted-foreground">
                Locked while scoring is active
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border/60 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <StartFormatFields
            values={values}
            onChange={setValues}
            disabled={isPending || setupLocked}
          />

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {!setupLocked && (
            <Button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="h-11 w-full sm:w-auto"
            >
              {isPending ? "Saving..." : "Save start schedule"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
