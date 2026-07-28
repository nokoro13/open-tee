"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive } from "lucide-react";

import { archiveEvent } from "@/actions/events";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Event } from "@/db/schema";
import { isRegistrationOpen } from "@/lib/events";

type EventLifecycleCardProps = {
  event: Event;
};

export function EventLifecycleCard({ event }: EventLifecycleCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const scoringStarted =
    event.scoringStatus === "open" || event.scoringStatus === "finalized";
  const registrationOpen = isRegistrationOpen(event);

  function runAction(
    action: () => Promise<{ success: boolean; error?: string }>,
    onSuccess?: () => void
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Event lifecycle</CardTitle>
        <CardDescription>
          Archive the event when it is complete. Registration is managed in
          Registration features above.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3 text-sm">
          <p className="font-medium capitalize">{event.status.replace("_", " ")}</p>
          <p className="mt-1 text-muted-foreground">
            {event.status === "archived"
              ? "This event is archived and kept for historical reference."
              : scoringStarted
                ? "Registration is locked while scoring is active."
                : registrationOpen
                  ? "Registration is open."
                  : "Registration is closed."}
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {event.status !== "archived" && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={isPending}
              onClick={() => setArchiveDialogOpen(true)}
            >
              <Archive />
              Archive event
            </Button>
            <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive this event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Archived events stay visible for results and records, but
                    registration stays closed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      runAction(() => archiveEvent(event.id), () =>
                        setArchiveDialogOpen(false)
                      )
                    }
                  >
                    Archive event
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
