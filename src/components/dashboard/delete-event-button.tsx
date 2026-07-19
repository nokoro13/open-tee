"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deleteEvent } from "@/actions/events";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Event } from "@/db/schema";
import { Button } from "@/components/ui/button";

type DeleteEventButtonProps = {
  eventId: string;
  eventName: string;
  status: Event["status"];
  variant?: "default" | "compact";
  className?: string;
};

function getDeleteDescription(eventName: string, status: Event["status"]) {
  if (status === "draft") {
    return `Delete "${eventName}"? This draft and all its data will be permanently removed.`;
  }

  return `Delete "${eventName}"? This will permanently remove all registrations, pairings, scores, and public event pages. This cannot be undone.`;
}

export function DeleteEventButton({
  eventId,
  eventName,
  status,
  variant = "default",
  className,
}: DeleteEventButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteEvent(eventId);
      if ("success" in result && !result.success) {
        setError(result.error);
        return;
      }
      setDialogOpen(false);
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant === "compact" ? "ghost" : "destructive"}
        size={variant === "compact" ? "icon-sm" : "lg"}
        className={
          variant === "compact"
            ? "text-muted-foreground hover:text-destructive"
            : "h-11 w-full sm:w-auto"
        }
        disabled={isPending}
        aria-label={variant === "compact" ? `Delete ${eventName}` : undefined}
        onClick={() => setDialogOpen(true)}
      >
        <Trash2 className={variant === "compact" ? "size-4" : undefined} />
        {variant === "default" &&
          (isPending ? "Deleting..." : status === "draft" ? "Delete draft" : "Delete event")}
      </Button>

      {error && (
        <p
          className={variant === "compact" ? "mt-1 text-xs text-destructive" : "mt-2 text-sm text-destructive"}
          role="alert"
        >
          {error}
        </p>
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {status === "draft" ? "Delete draft?" : "Delete event?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getDeleteDescription(eventName, status)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending ? "Deleting..." : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
