import type { Event } from "@/db/schema";
import { formatFee } from "@/lib/events";

export type ActivePricing = {
  feeCents: number;
};

export function getActiveEntryFee(
  event: Pick<Event, "entryFeeCents">
): ActivePricing {
  return { feeCents: event.entryFeeCents };
}

export function formatPricingSummary(pricing: ActivePricing): string {
  return formatFee(pricing.feeCents);
}
