"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getEventById } from "@/actions/events";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { normalizeHexColor } from "@/lib/event-branding";
import {
  canUseProFeature,
  isProEvent,
  type PlatformTier,
  validateMaxPlayersForTier,
} from "@/lib/platform-tier";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export async function setEventPlatformTier(
  eventId: string,
  tier: PlatformTier
): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event || event.orgId !== org.id) {
    return { success: false, error: "Event not found." };
  }

  if (event.status !== "draft") {
    return {
      success: false,
      error: "Tier can only be changed while the event is a draft.",
    };
  }

  const maxPlayersError = validateMaxPlayersForTier(event.maxPlayers, tier);
  if (maxPlayersError) {
    return { success: false, error: maxPlayersError };
  }

  await getDb()
    .update(events)
    .set({
      platformTier: tier,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  revalidatePath(`/dashboard/events/${eventId}`);
  return { success: true };
}

export type ProSettingsInput = {
  waitlistEnabled?: boolean;
  groupRegistrationEnabled?: boolean;
  maxGroupSize?: number;
  smsRemindersEnabled?: boolean;
  earlyBirdFeeDollars?: number | null;
  earlyBirdEndsAt?: string | null;
};

export async function updateProSettings(
  eventId: string,
  input: ProSettingsInput
): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event || event.orgId !== org.id) {
    return { success: false, error: "Event not found." };
  }

  if (!isProEvent(event)) {
    return { success: false, error: "Pro settings require a Pro event." };
  }

  const updates: Partial<typeof events.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.waitlistEnabled != null) {
    updates.waitlistEnabled = input.waitlistEnabled;
  }

  if (input.groupRegistrationEnabled != null) {
    updates.groupRegistrationEnabled = input.groupRegistrationEnabled;
  }

  if (input.maxGroupSize != null) {
    if (input.maxGroupSize < 2 || input.maxGroupSize > 4) {
      return { success: false, error: "Group size must be between 2 and 4." };
    }
    updates.maxGroupSize = input.maxGroupSize;
  }

  if (input.smsRemindersEnabled != null) {
    updates.smsRemindersEnabled = input.smsRemindersEnabled;
  }

  if ("earlyBirdFeeDollars" in input) {
    if (input.earlyBirdFeeDollars == null) {
      updates.earlyBirdFeeCents = null;
      updates.earlyBirdEndsAt = null;
    } else {
      if (input.earlyBirdFeeDollars < 0) {
        return { success: false, error: "Early bird fee cannot be negative." };
      }
      if (input.earlyBirdFeeDollars >= event.entryFeeCents / 100) {
        return {
          success: false,
          error: "Early bird fee must be lower than the standard entry fee.",
        };
      }
      updates.earlyBirdFeeCents = Math.round(input.earlyBirdFeeDollars * 100);
    }
  }

  if ("earlyBirdEndsAt" in input) {
    updates.earlyBirdEndsAt = input.earlyBirdEndsAt
      ? new Date(input.earlyBirdEndsAt)
      : null;
  }

  await getDb().update(events).set(updates).where(eq(events.id, eventId));

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}

export type BrandingInput = {
  primaryColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
};

export async function updateEventBranding(
  eventId: string,
  input: BrandingInput
): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event || event.orgId !== org.id) {
    return { success: false, error: "Event not found." };
  }

  if (!canUseProFeature(event, "custom_branding")) {
    return { success: false, error: "Custom branding requires a Pro event." };
  }

  await getDb()
    .update(events)
    .set({
      primaryColor: normalizeHexColor(input.primaryColor),
      accentColor: normalizeHexColor(input.accentColor),
      logoUrl: input.logoUrl?.trim() || null,
      coverImageUrl: input.coverImageUrl?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(events.id, eventId), eq(events.orgId, org.id)));

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}
