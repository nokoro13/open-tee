import type { Organization } from "@/db/schema";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
]);

export function isOrgSubscriptionActive(
  org: Pick<
    Organization,
    "subscriptionStatus" | "subscriptionCurrentPeriodEnd"
  >
): boolean {
  if (!org.subscriptionStatus || !ACTIVE_SUBSCRIPTION_STATUSES.has(org.subscriptionStatus)) {
    return false;
  }

  if (!org.subscriptionCurrentPeriodEnd) {
    return true;
  }

  return org.subscriptionCurrentPeriodEnd.getTime() > Date.now();
}

export function canPublishWithoutEventFee(
  org: Pick<
    Organization,
    "subscriptionStatus" | "subscriptionCurrentPeriodEnd"
  >
): boolean {
  return isOrgSubscriptionActive(org);
}
