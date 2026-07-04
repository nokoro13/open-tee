"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deleteEvent } from "@/actions/events";
import type { Event } from "@/db/schema";
import { Button } from "@/components/ui/button";

type DeleteEventButtonProps = {
  eventId: string;
  eventName: string;
  status: Event["status"];
  variant?: "default" | "compact";
  className?: string;
};

function getConfirmMessage(eventName: string, status: Event["status"]) {
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

  function handleDelete() {
    if (!confirm(getConfirmMessage(eventName, status))) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteEvent(eventId);
      if ("success" in result && !result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (variant === "compact") {
    return (
      <div className={className}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          disabled={isPending}
          aria-label={`Delete ${eventName}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDelete();
          }}
        >
          <Trash2 className="size-4" />
        </Button>
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="destructive"
        size="lg"
        className="h-11 w-full sm:w-auto"
        disabled={isPending}
        onClick={handleDelete}
      >
        <Trash2 />
        {isPending ? "Deleting..." : status === "draft" ? "Delete draft" : "Delete event"}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
