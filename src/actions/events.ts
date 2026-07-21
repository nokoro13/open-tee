"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { events, type Event } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import {
  replaceEventScorecard,
  type ScorecardHoleSnapshot,
} from "@/lib/scorecard";
import type { EventFormat } from "@/lib/event-formats";
import { getEventFormat } from "@/lib/event-formats";
import { generateEventSlug } from "@/lib/slug";
import type { StartFormat } from "@/lib/start-format";
import {
  parseRegistrationWindowInput,
  type RegistrationWindowInput,
} from "@/lib/registration-window";
import {
  getMaxPlayersForTier,
  validateMaxPlayersForTier,
  type PlatformTier,
} from "@/lib/platform-tier";
import {
  DEFAULT_FIRST_TEE_TIME,
  DEFAULT_SHOTGUN_START_TIME,
  DEFAULT_TEE_TIME_INTERVAL_MINUTES,
  validateStartFormatSettings,
} from "@/lib/start-format";

export type EventFormInput = {
  name: string;
  date: string;
  courseName: string;
  externalCourseId?: string | null;
  nineSide?: "front" | "back" | null;
  scorecardHoles?: ScorecardHoleSnapshot[];
  courseAddress?: string | null;
  courseCity?: string | null;
  courseState?: string | null;
  coursePhone?: string | null;
  courseWebsite?: string | null;
  selectedTeeKey?: string | null;
  teeName?: string | null;
  courseRating?: string | null;
  courseSlope?: number | null;
  courseTotalYardage?: number | null;
  format: EventFormat;
  holes: "9" | "18";
  maxPlayers: number;
  entryFeeDollars: number;
  platformTier?: PlatformTier;
  description?: string;
  teamAName?: string;
  teamBName?: string;
  startFormat: StartFormat;
  shotgunStartTime?: string | null;
  firstTeeTime?: string | null;
  teeTimeIntervalMinutes?: number | null;
  opensDate?: string | null;
  opensTime?: string | null;
  closesDate?: string | null;
  closesTime?: string | null;
};

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

function parseEventInput(input: EventFormInput): EventFormInput | ActionResult {
  if (!input.name.trim()) {
    return { success: false, error: "Event name is required." };
  }
  if (!input.date) {
    return { success: false, error: "Event date is required." };
  }
  if (!input.courseName.trim()) {
    return { success: false, error: "Course name is required." };
  }
  if (input.maxPlayers < 1) {
    return { success: false, error: "Max players must be at least 1." };
  }

  const tier = input.platformTier ?? "starter";
  const maxPlayersError = validateMaxPlayersForTier(input.maxPlayers, tier);
  if (maxPlayersError) {
    return { success: false, error: maxPlayersError };
  }
  if (input.entryFeeDollars < 0) {
    return { success: false, error: "Entry fee cannot be negative." };
  }
  if (!getEventFormat(input.format)) {
    return { success: false, error: "Invalid event format." };
  }

  if (input.format === "ryder_cup") {
    if (!input.teamAName?.trim()) {
      return { success: false, error: "Team A name is required for Ryder Cup." };
    }
    if (!input.teamBName?.trim()) {
      return { success: false, error: "Team B name is required for Ryder Cup." };
    }
  }

  const startFormatError = validateStartFormatSettings({
    startFormat: input.startFormat,
    shotgunStartTime: input.shotgunStartTime ?? null,
    firstTeeTime: input.firstTeeTime ?? null,
    teeTimeIntervalMinutes: input.teeTimeIntervalMinutes ?? null,
  });
  if (startFormatError) {
    return { success: false, error: startFormatError };
  }

  const windowResult = parseRegistrationWindowInput({
    opensDate: input.opensDate ?? "",
    opensTime: input.opensTime ?? "",
    closesDate: input.closesDate ?? "",
    closesTime: input.closesTime ?? "",
  });
  if ("error" in windowResult) {
    return { success: false, error: windowResult.error };
  }

  return input;
}

function registrationWindowValues(input: EventFormInput) {
  const parsed = parseRegistrationWindowInput({
    opensDate: input.opensDate ?? "",
    opensTime: input.opensTime ?? "",
    closesDate: input.closesDate ?? "",
    closesTime: input.closesTime ?? "",
  });
  if ("error" in parsed) {
    return { registrationOpens: null, registrationCloses: null };
  }
  return {
    registrationOpens: parsed.opens,
    registrationCloses: parsed.closes,
  };
}

function startFormatValues(input: EventFormInput) {
  return {
    startFormat: input.startFormat,
    shotgunStartTime:
      input.startFormat === "shotgun"
        ? input.shotgunStartTime?.trim() || DEFAULT_SHOTGUN_START_TIME
        : null,
    firstTeeTime:
      input.startFormat === "tee_times"
        ? input.firstTeeTime?.trim() || DEFAULT_FIRST_TEE_TIME
        : null,
    teeTimeIntervalMinutes:
      input.startFormat === "tee_times"
        ? input.teeTimeIntervalMinutes ?? DEFAULT_TEE_TIME_INTERVAL_MINUTES
        : null,
  };
}

async function persistScorecard(
  eventId: string,
  input: EventFormInput
) {
  if (input.scorecardHoles?.length) {
    await replaceEventScorecard(eventId, input.scorecardHoles);
    return;
  }

  await replaceEventScorecard(eventId, []);
}

function courseMetadataValues(input: EventFormInput) {
  if (!input.externalCourseId) {
    return {
      courseAddress: null,
      courseCity: null,
      courseState: null,
      coursePhone: null,
      courseWebsite: null,
      selectedTeeKey: null,
      teeName: null,
      courseRating: null,
      courseSlope: null,
      courseTotalYardage: null,
    };
  }

  return {
    courseAddress: input.courseAddress ?? null,
    courseCity: input.courseCity ?? null,
    courseState: input.courseState ?? null,
    coursePhone: input.coursePhone ?? null,
    courseWebsite: input.courseWebsite ?? null,
    selectedTeeKey: input.selectedTeeKey ?? null,
    teeName: input.teeName ?? null,
    courseRating: input.courseRating ?? null,
    courseSlope: input.courseSlope ?? null,
    courseTotalYardage: input.courseTotalYardage ?? null,
  };
}

export async function getEventsForOrg(): Promise<Event[]> {
  const org = await requireOrganization();
  return getDb().query.events.findMany({
    where: eq(events.orgId, org.id),
    orderBy: [desc(events.date), desc(events.createdAt)],
  });
}

export async function getEventById(id: string): Promise<Event | undefined> {
  const org = await requireOrganization();
  return getDb().query.events.findFirst({
    where: and(eq(events.id, id), eq(events.orgId, org.id)),
  });
}

export async function getEventByIdWithScorecard(id: string) {
  const org = await requireOrganization();
  return getDb().query.events.findFirst({
    where: and(eq(events.id, id), eq(events.orgId, org.id)),
    with: {
      eventHoles: {
        orderBy: (eventHoles, { asc }) => [asc(eventHoles.holeNumber)],
      },
    },
  });
}

export async function createEvent(
  input: EventFormInput
): Promise<ActionResult> {
  const parsed = parseEventInput(input);
  if ("success" in parsed) {
    return parsed;
  }

  const org = await requireOrganization();

  const [event] = await getDb()
    .insert(events)
    .values({
      orgId: org.id,
      slug: generateEventSlug(parsed.name),
      name: parsed.name.trim(),
      date: parsed.date,
      courseName: parsed.courseName.trim(),
      externalCourseId: parsed.externalCourseId ?? null,
      nineSide: parsed.nineSide ?? null,
      ...courseMetadataValues(parsed),
      format: parsed.format,
      holes: parsed.holes,
      maxPlayers: parsed.maxPlayers,
      entryFeeCents: Math.round(parsed.entryFeeDollars * 100),
      description: parsed.description?.trim() || null,
      teamAName:
        parsed.format === "ryder_cup" ? parsed.teamAName?.trim() || null : null,
      teamBName:
        parsed.format === "ryder_cup" ? parsed.teamBName?.trim() || null : null,
      ...startFormatValues(parsed),
      ...registrationWindowValues(parsed),
      status: "draft",
    })
    .returning();

  await persistScorecard(event.id, parsed);

  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${event.id}`);
}

export async function updateEvent(
  id: string,
  input: EventFormInput
): Promise<ActionResult> {
  const parsed = parseEventInput(input);
  if ("success" in parsed) {
    return parsed;
  }

  const org = await requireOrganization();
  const existing = await getEventById(id);

  if (!existing) {
    return { success: false, error: "Event not found." };
  }

  if (existing.status !== "draft") {
    return {
      success: false,
      error: "Only draft events can be edited in this version.",
    };
  }

  await getDb()
    .update(events)
    .set({
      name: parsed.name.trim(),
      date: parsed.date,
      courseName: parsed.courseName.trim(),
      externalCourseId: parsed.externalCourseId ?? null,
      nineSide: parsed.nineSide ?? null,
      ...courseMetadataValues(parsed),
      format: parsed.format,
      holes: parsed.holes,
      maxPlayers: parsed.maxPlayers,
      entryFeeCents: Math.round(parsed.entryFeeDollars * 100),
      description: parsed.description?.trim() || null,
      teamAName:
        parsed.format === "ryder_cup" ? parsed.teamAName?.trim() || null : null,
      teamBName:
        parsed.format === "ryder_cup" ? parsed.teamBName?.trim() || null : null,
      ...startFormatValues(parsed),
      ...registrationWindowValues(parsed),
      updatedAt: new Date(),
    })
    .where(and(eq(events.id, id), eq(events.orgId, org.id)));

  await persistScorecard(id, parsed);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/events/${id}`);
  return { success: true };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const org = await requireOrganization();
  const existing = await getEventById(id);

  if (!existing) {
    return { success: false, error: "Event not found." };
  }

  await getDb()
    .delete(events)
    .where(and(eq(events.id, id), eq(events.orgId, org.id)));

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateRegistrationWindow(
  eventId: string,
  input: RegistrationWindowInput
): Promise<ActionResult> {
  const org = await requireOrganization();
  const existing = await getEventById(eventId);

  if (!existing) {
    return { success: false, error: "Event not found." };
  }

  if (existing.status !== "published") {
    return {
      success: false,
      error: "Registration window can only be updated for live events.",
    };
  }

  const windowResult = parseRegistrationWindowInput(input);
  if ("error" in windowResult) {
    return { success: false, error: windowResult.error };
  }

  await getDb()
    .update(events)
    .set({
      registrationOpens: windowResult.opens,
      registrationCloses: windowResult.closes,
      updatedAt: new Date(),
    })
    .where(and(eq(events.id, eventId), eq(events.orgId, org.id)));

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${existing.slug}`);
  return { success: true };
}

export async function closeEventRegistration(eventId: string): Promise<ActionResult> {
  const org = await requireOrganization();
  const existing = await getEventById(eventId);

  if (!existing) {
    return { success: false, error: "Event not found." };
  }

  if (existing.status !== "published") {
    return { success: false, error: "Only live events can be closed." };
  }

  const now = new Date();

  await getDb()
    .update(events)
    .set({
      status: "closed",
      registrationFinalizedAt: existing.registrationFinalizedAt ?? now,
      registrationCloses: existing.registrationCloses ?? now,
      updatedAt: now,
    })
    .where(and(eq(events.id, eventId), eq(events.orgId, org.id)));

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${existing.slug}`);
  return { success: true };
}

export async function reopenEventRegistration(eventId: string): Promise<ActionResult> {
  const org = await requireOrganization();
  const existing = await getEventById(eventId);

  if (!existing) {
    return { success: false, error: "Event not found." };
  }

  if (existing.status !== "closed") {
    return { success: false, error: "Only closed events can be reopened." };
  }

  if (existing.scoringStatus !== "disabled") {
    return {
      success: false,
      error: "Cannot reopen registration after scoring has started.",
    };
  }

  await getDb()
    .update(events)
    .set({
      status: "published",
      registrationFinalizedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(events.id, eventId), eq(events.orgId, org.id)));

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${existing.slug}`);
  return { success: true };
}

export async function archiveEvent(eventId: string): Promise<ActionResult> {
  const org = await requireOrganization();
  const existing = await getEventById(eventId);

  if (!existing) {
    return { success: false, error: "Event not found." };
  }

  if (existing.status === "draft") {
    return { success: false, error: "Draft events should be deleted, not archived." };
  }

  if (existing.status === "archived") {
    return { success: false, error: "Event is already archived." };
  }

  const now = new Date();

  await getDb()
    .update(events)
    .set({
      status: "archived",
      registrationCloses: existing.registrationCloses ?? now,
      updatedAt: now,
    })
    .where(and(eq(events.id, eventId), eq(events.orgId, org.id)));

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${existing.slug}`);
  return { success: true };
}
