"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";

import {
  createBillingPortalSession,
  startAnnualSubscriptionCheckout,
} from "@/actions/subscription";
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
import type { Organization } from "@/db/schema";
import { isOrgSubscriptionActive } from "@/lib/subscription";

type CoursePlanCardProps = {
  organization: Organization;
  subscribed?: boolean;
  subscribeCanceled?: boolean;
};

export function CoursePlanCard({
  organization,
  subscribed,
  subscribeCanceled,
}: CoursePlanCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isActive = isOrgSubscriptionActive(organization);
  const annualFee = formatCad(getAnnualCoursePlanFeeCents());
  const eventFee = formatCad(getEventHostingFeeCents());

  function handleSubscribe() {
    setError(null);
    startTransition(async () => {
      const result = await startAnnualSubscriptionCheckout();
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  function handleManageBilling() {
    setError(null);
    startTransition(async () => {
      const result = await createBillingPortalSession();
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  const renewalDate = organization.subscriptionCurrentPeriodEnd
    ? organization.subscriptionCurrentPeriodEnd.toLocaleDateString("en-CA", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4" />
          Course Plan
        </CardTitle>
        <CardDescription>
          Host unlimited events for {annualFee} CAD per year, or pay {eventFee}{" "}
          CAD per event.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {subscribed && isActive && (
          <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
            Your Course Plan is active. You can publish events without a
            per-event fee.
          </p>
        )}

        {subscribeCanceled && (
          <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Checkout was canceled. You can subscribe whenever you&apos;re ready.
          </p>
        )}

        {isActive ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
              <p className="font-medium">Annual subscription active</p>
              {renewalDate && (
                <p className="mt-1 text-muted-foreground">
                  Renews on {renewalDate}
                </p>
              )}
              {organization.subscriptionStatus === "past_due" && (
                <p className="mt-2 text-destructive">
                  Payment is past due — update your billing details to keep
                  publishing events.
                </p>
              )}
            </div>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={handleManageBilling}
            >
              {isPending ? "Opening..." : "Manage billing"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• Unlimited events per year</li>
              <li>• Full platform — branding, sponsors, analytics</li>
              <li>• Best value if you run 13+ events per year</li>
            </ul>
            <Button disabled={isPending} onClick={handleSubscribe}>
              {isPending ? "Redirecting..." : `Subscribe — ${annualFee}/year`}
            </Button>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
