import type { Event } from "@/db/schema";
import { formatFee } from "@/lib/events";

export type ActivePricing = {
  feeCents: number;
  label: string;
  isEarlyBird: boolean;
  regularFeeCents: number;
  earlyBirdEndsAt: Date | null;
};

export function getActiveEntryFee(event: Pick<
  Event,
  "entryFeeCents" | "earlyBirdFeeCents" | "earlyBirdEndsAt"
>): ActivePricing {
  const regularFeeCents = event.entryFeeCents;
  const now = new Date();

  if (
    event.earlyBirdFeeCents != null &&
    event.earlyBirdEndsAt &&
    now < event.earlyBirdEndsAt
  ) {
    return {
      feeCents: event.earlyBirdFeeCents,
      label: "Early bird",
      isEarlyBird: true,
      regularFeeCents,
      earlyBirdEndsAt: event.earlyBirdEndsAt,
    };
  }

  return {
    feeCents: regularFeeCents,
    label: "Standard",
    isEarlyBird: false,
    regularFeeCents,
    earlyBirdEndsAt: event.earlyBirdEndsAt,
  };
}

export function formatPricingSummary(pricing: ActivePricing): string {
  if (pricing.isEarlyBird) {
    return `${formatFee(pricing.feeCents)} early bird (regular ${formatFee(pricing.regularFeeCents)})`;
  }
  return formatFee(pricing.feeCents);
}
