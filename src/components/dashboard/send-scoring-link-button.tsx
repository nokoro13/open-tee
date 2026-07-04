"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";

import { emailPlayerScoringLink } from "@/actions/scoring";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SendScoringLinkButtonProps = {
  eventId: string;
  registrationId: string;
  disabled?: boolean;
  className?: string;
};

export function SendScoringLinkButton({
  eventId,
  registrationId,
  disabled = false,
  className,
}: SendScoringLinkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await emailPlayerScoringLink(eventId, registrationId);
      if (!result.success) {
        setMessage({
          type: "error",
          text: result.error ?? "Could not send email.",
        });
        return;
      }

      setMessage({ type: "success", text: "Email sent." });
    });
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isPending}
        onClick={handleClick}
      >
        <Mail />
        {isPending ? "Sending..." : "Email link"}
      </Button>
      {message && (
        <p
          className={cn(
            "max-w-48 text-right text-xs",
            message.type === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          )}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
