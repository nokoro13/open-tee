import type { Event } from "@/db/schema";
import { canUseProFeature } from "@/lib/platform-tier";

export type EventBranding = {
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
};

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function getEventBranding(
  event: Pick<
    Event,
    | "platformTier"
    | "logoUrl"
    | "coverImageUrl"
    | "primaryColor"
    | "accentColor"
  >
): EventBranding | null {
  if (!canUseProFeature(event, "custom_branding")) {
    return null;
  }

  return {
    logoUrl: event.logoUrl,
    coverImageUrl: event.coverImageUrl,
    primaryColor: normalizeHexColor(event.primaryColor),
    accentColor: normalizeHexColor(event.accentColor),
  };
}

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return HEX_COLOR.test(withHash) ? withHash : null;
}

export function brandingStyleVars(
  branding: EventBranding | null
): Record<string, string> {
  if (!branding) return {};

  const vars: Record<string, string> = {};
  if (branding.primaryColor) {
    vars["--event-primary"] = branding.primaryColor;
  }
  if (branding.accentColor) {
    vars["--event-accent"] = branding.accentColor;
  }
  return vars;
}
