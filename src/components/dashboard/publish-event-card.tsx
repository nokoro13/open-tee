"use client";

import { useState, useTransition } from "react";
import { Rocket } from "lucide-react";

import { startPublishCheckout } from "@/actions/publish";
import { setEventPlatformTier } from "@/actions/pro-features";
import {
  PLATFORM_TIER_FEES_CENTS,
  PLATFORM_TIER_LABELS,
  STARTER_MAX_PLAYERS,
  type PlatformTier,
} from "@/lib/platform-tier";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PublishEventCardProps = {
  eventId: string;
  eventName: string;
  currentTier: PlatformTier | null | undefined;
  maxPlayers: number;
};

function normalizePlatformTier(tier: PlatformTier | null | undefined): PlatformTier {
  return tier === "pro" ? "pro" : "starter";
}

const TIER_DETAILS: Record<
  PlatformTier,
  { price: number; headline: string; features: string[] }
> = {
  starter: {
    price: PLATFORM_TIER_FEES_CENTS.starter,
    headline: "Everything you need for a standard outing",
    features: [
      `Up to ${STARTER_MAX_PLAYERS} players`,
      "Online registration & payments",
      "Live scoring & leaderboard",
      "Email confirmations & reminders",
    ],
  },
  pro: {
    price: PLATFORM_TIER_FEES_CENTS.pro,
    headline: "Premium tools for larger or branded events",
    features: [
      "Unlimited players",
      "Custom branding & sponsor packages",
      "Waitlist, early-bird & group registration",
      "SMS reminders, flights & analytics",
    ],
  },
};

export function PublishEventCard({
  eventId,
  eventName,
  currentTier,
  maxPlayers,
}: PublishEventCardProps) {
  const [tier, setTier] = useState<PlatformTier>(() =>
    normalizePlatformTier(currentTier)
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      const publishTier = normalizePlatformTier(tier);
      const tierResult = await setEventPlatformTier(eventId, publishTier);
      if (!tierResult.success) {
        setError(tierResult.error);
        return;
      }

      const result = await startPublishCheckout(eventId, publishTier);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  const selectedTier = normalizePlatformTier(tier);
  const feeDisplay = `$${(TIER_DETAILS[selectedTier].price / 100).toFixed(0)}`;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>Ready to go live?</CardTitle>
        <CardDescription>
          Choose a plan and publish &quot;{eventName}&quot; to open registration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["starter", "pro"] as PlatformTier[]).map((option) => {
            const details = TIER_DETAILS[option];
            const selected = selectedTier === option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => setTier(option)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-background shadow-sm"
                    : "border-border/70 bg-background/60 hover:border-primary/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading text-lg font-semibold">
                    {PLATFORM_TIER_LABELS[option]}
                  </span>
                  <span className="text-sm font-medium text-primary">
                    ${(details.price / 100).toFixed(0)}/event
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {details.headline}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {details.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {selectedTier === "starter" && maxPlayers > STARTER_MAX_PLAYERS && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            This event is set to {maxPlayers} players. Starter supports up to{" "}
            {STARTER_MAX_PLAYERS} — choose Pro or lower capacity before publishing.
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          size="lg"
          className="h-11 w-full sm:w-auto"
          disabled={
            isPending ||
            (selectedTier === "starter" && maxPlayers > STARTER_MAX_PLAYERS)
          }
          onClick={handlePublish}
        >
          <Rocket />
          {isPending
            ? "Redirecting to checkout..."
            : `Publish with ${PLATFORM_TIER_LABELS[selectedTier]} — ${feeDisplay}`}
        </Button>
      </CardContent>
    </Card>
  );
}
