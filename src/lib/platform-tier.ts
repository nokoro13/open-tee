import type { Event } from "@/db/schema";

export type PlatformTier = "starter" | "pro";

export const STARTER_MAX_PLAYERS = 72;
export const PRO_MAX_PLAYERS = 10_000;

export const PLATFORM_TIER_LABELS: Record<PlatformTier, string> = {
  starter: "Starter",
  pro: "Pro",
};

export const PLATFORM_TIER_FEES_CENTS: Record<PlatformTier, number> = {
  starter: 4900,
  pro: 14_900,
};

export type ProFeature =
  | "unlimited_players"
  | "custom_branding"
  | "sponsor_packages"
  | "waitlist"
  | "early_bird_pricing"
  | "group_registration"
  | "sms_reminders"
  | "multi_flight"
  | "post_event_analytics";

const PRO_FEATURES = new Set<ProFeature>([
  "unlimited_players",
  "custom_branding",
  "sponsor_packages",
  "waitlist",
  "early_bird_pricing",
  "group_registration",
  "sms_reminders",
  "multi_flight",
  "post_event_analytics",
]);

export function getEventPlatformTier(
  event: Pick<Event, "platformTier"> | { platformTier?: PlatformTier | null }
): PlatformTier {
  return event.platformTier === "pro" ? "pro" : "starter";
}

export function isProEvent(event: Pick<Event, "platformTier">): boolean {
  return getEventPlatformTier(event) === "pro";
}

export function canUseProFeature(
  event: Pick<Event, "platformTier">,
  feature: ProFeature
): boolean {
  if (!PRO_FEATURES.has(feature)) return false;
  return isProEvent(event);
}

export function getMaxPlayersForTier(tier: PlatformTier): number {
  return tier === "pro" ? PRO_MAX_PLAYERS : STARTER_MAX_PLAYERS;
}

export function getPlatformFeeCentsForTier(tier: PlatformTier): number {
  const envKey =
    tier === "pro"
      ? process.env.STRIPE_PRO_PLATFORM_FEE_CENTS
      : process.env.STRIPE_PLATFORM_FEE_CENTS;

  if (envKey) {
    const parsed = Number.parseInt(envKey, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return PLATFORM_TIER_FEES_CENTS[tier];
}

export function validateMaxPlayersForTier(
  maxPlayers: number,
  tier: PlatformTier
): string | null {
  if (maxPlayers < 1) {
    return "Max players must be at least 1.";
  }

  const cap = getMaxPlayersForTier(tier);
  if (maxPlayers > cap) {
    if (tier === "starter") {
      return `Starter events support up to ${STARTER_MAX_PLAYERS} players. Upgrade to Pro for larger fields.`;
    }
    return `Max players cannot exceed ${cap.toLocaleString()}.`;
  }

  return null;
}
