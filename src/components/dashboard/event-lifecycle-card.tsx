"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, Lock, Unlock } from "lucide-react";

import {
  archiveEvent,
  closeEventRegistration,
  reopenEventRegistration,
} from "@/actions/events";
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

type EventLifecycleCardProps = {
  event: Event;
};

export function EventLifecycleCard({ event }: EventLifecycleCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

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
          Control registration availability and archive the event when it is complete.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3 text-sm">
          <p className="font-medium capitalize">{event.status.replace("_", " ")}</p>
          <p className="mt-1 text-muted-foreground">
            {event.status === "published" &&
              "Registration is open according to your registration window."}
            {event.status === "closed" &&
              "Registration is closed. Scoring and the public event page remain available."}
            {event.status === "archived" &&
              "This event is archived and kept for historical reference."}
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {event.status === "published" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={isPending}
                onClick={() => setCloseDialogOpen(true)}
              >
                <Lock />
                Close registration
              </Button>
              <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close registration?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Players will no longer be able to register. You can reopen
                      registration later if scoring has not started.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        runAction(() => closeEventRegistration(event.id), () =>
                          setCloseDialogOpen(false)
                        )
                      }
                    >
                      Close registration
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {event.status === "closed" && event.scoringStatus === "disabled" && (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={isPending}
              onClick={() => runAction(() => reopenEventRegistration(event.id))}
            >
              <Unlock />
              Reopen registration
            </Button>
          )}

          {event.status !== "archived" && (
            <>
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
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
