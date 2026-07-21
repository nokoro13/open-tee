"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Clock } from "lucide-react";

import { updateEventStartFormat } from "@/actions/start-format";
import {
  defaultStartFormatFieldValues,
  StartFormatFields,
  type StartFormatFieldValues,
} from "@/components/dashboard/start-format-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isEventSetupLocked,
  type EventScoringStatus,
} from "@/lib/event-setup-lock";
import { getStartFormatSummary } from "@/lib/start-format";

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
  const [values, setValues] = useState<StartFormatFieldValues>(() =>
    defaultStartFormatFieldValues(event)
  );
  const setupLocked = isEventSetupLocked(scoringStatus);

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
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Clock className="size-4 shrink-0" />
          Start schedule
        </CardTitle>
        <CardDescription className="text-pretty text-xs sm:text-sm">
          {getStartFormatSummary({
            startFormat: event.startFormat,
            shotgunStartTime: event.shotgunStartTime,
            firstTeeTime: event.firstTeeTime,
            teeTimeIntervalMinutes: event.teeTimeIntervalMinutes,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}
