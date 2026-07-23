import type { Event } from "@/db/schema";

import { MAX_EVENT_PLAYERS } from "@/lib/billing";

/** @deprecated Legacy tier field — all paid events use the full platform. */
export type PlatformTier = "starter" | "pro";

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

export function getEventPlatformTier(
  event: Pick<Event, "platformTier"> | { platformTier?: PlatformTier | null }
): PlatformTier {
  return event.platformTier === "pro" ? "pro" : "starter";
}

/** All platform features are included with event hosting or an annual plan. */
export function isProEvent(_event: Pick<Event, "platformTier">): boolean {
  return true;
}

export function canUseProFeature(
  _event: Pick<Event, "platformTier">,
  _feature: ProFeature
): boolean {
  return true;
}

export function getMaxPlayersForTier(_tier?: PlatformTier): number {
  return MAX_EVENT_PLAYERS;
}

export function validateMaxPlayersForTier(maxPlayers: number): string | null {
  if (maxPlayers < 1) {
    return "Max players must be at least 1.";
  }

  if (maxPlayers > MAX_EVENT_PLAYERS) {
    return `Max players cannot exceed ${MAX_EVENT_PLAYERS.toLocaleString()}.`;
  }

  return null;
}
