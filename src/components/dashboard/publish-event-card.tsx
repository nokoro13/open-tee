"use client";

import { useState, useTransition } from "react";
import { CreditCard, Rocket } from "lucide-react";

import { startPublishCheckout } from "@/actions/publish";
import { startAnnualSubscriptionCheckout } from "@/actions/subscription";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatCad,
  getAnnualCoursePlanFeeCents,
  getEventHostingFeeCents,
} from "@/lib/billing";
import { cn } from "@/lib/utils";

type PublishEventCardProps = {
  eventId: string;
  eventName: string;
  hasActiveSubscription: boolean;
  subscribed?: boolean;
  subscribeCanceled?: boolean;
};

const INCLUDED_FEATURES = [
  "Online registration & payments",
  "Live scoring & public leaderboard",
  "Custom branding & sponsor packages",
  "Waitlist, group registration & SMS reminders",
  "Flights & post-event analytics",
];

type PricingChoice = "event" | "annual";

export function PublishEventCard({
  eventId,
  eventName,
  hasActiveSubscription,
  subscribed,
  subscribeCanceled,
}: PublishEventCardProps) {
  const [choice, setChoice] = useState<PricingChoice>("event");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const eventFee = formatCad(getEventHostingFeeCents());
  const annualFee = formatCad(getAnnualCoursePlanFeeCents());

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await startPublishCheckout(eventId);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  function handleSubscribe() {
    setError(null);
    startTransition(async () => {
      const result = await startAnnualSubscriptionCheckout(eventId);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  function handleContinue() {
    if (choice === "annual") {
      handleSubscribe();
    } else {
      handlePublish();
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>Ready to go live?</CardTitle>
        <CardDescription>
          Publish &quot;{eventName}&quot; to open registration and share your
          event link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {hasActiveSubscription ? (
          <>
            <div className="rounded-2xl border border-primary/30 bg-background p-4">
              <p className="font-medium text-primary">
                Included in your Course Plan
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your annual subscription covers unlimited events — publish this
                one at no extra cost.
              </p>
            </div>

            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {INCLUDED_FEATURES.map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              size="lg"
              className="h-11 w-full sm:w-auto"
              disabled={isPending}
              onClick={handlePublish}
            >
              <Rocket />
              {isPending ? "Publishing..." : "Publish event"}
            </Button>
          </>
        ) : (
          <>
            {subscribed && (
              <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                Course Plan activated — you can publish this event for free, or
                any future events at no per-event cost.
              </p>
            )}

            {subscribeCanceled && (
              <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Subscription checkout was canceled. Choose an option below to
                continue.
              </p>
            )}

            <p className="text-sm font-medium">Choose how to pay</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setChoice("event")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors",
                  choice === "event"
                    ? "border-primary bg-background shadow-sm"
                    : "border-border/70 bg-background/60 hover:border-primary/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading text-lg font-semibold">
                    This event only
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {eventFee}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  One-time fee to publish this event. No subscription.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setChoice("annual")}
                className={cn(
                  "relative rounded-2xl border p-4 text-left transition-colors",
                  choice === "annual"
                    ? "border-primary bg-background shadow-sm"
                    : "border-border/70 bg-background/60 hover:border-primary/40"
                )}
              >
                <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                  Best value
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading text-lg font-semibold">
                    Course Plan
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {annualFee}/yr
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Unlimited events all year — publish this one and every future
                  event free.
                </p>
              </button>
            </div>

            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {INCLUDED_FEATURES.map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              size="lg"
              className="h-11 w-full sm:w-auto"
              disabled={isPending}
              onClick={handleContinue}
            >
              {choice === "annual" ? <CreditCard /> : <Rocket />}
              {isPending
                ? "Redirecting to checkout..."
                : choice === "annual"
                  ? `Subscribe — ${annualFee}/year`
                  : `Pay & publish — ${eventFee}`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
