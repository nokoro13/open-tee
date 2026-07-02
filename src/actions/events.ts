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

export type EventFormInput = {
  name: string;
  date: string;
  courseName: string;
  externalCourseId?: string | null;
  nineSide?: "front" | "back" | null;
  scorecardHoles?: ScorecardHoleSnapshot[];
  format: EventFormat;
  holes: "9" | "18";
  maxPlayers: number;
  entryFeeDollars: number;
  description?: string;
  teamAName?: string;
  teamBName?: string;
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
  if (input.maxPlayers < 1 || input.maxPlayers > 500) {
    return { success: false, error: "Max players must be between 1 and 500." };
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

  return input;
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
      format: parsed.format,
      holes: parsed.holes,
      maxPlayers: parsed.maxPlayers,
      entryFeeCents: Math.round(parsed.entryFeeDollars * 100),
      description: parsed.description?.trim() || null,
      teamAName:
        parsed.format === "ryder_cup" ? parsed.teamAName?.trim() || null : null,
      teamBName:
        parsed.format === "ryder_cup" ? parsed.teamBName?.trim() || null : null,
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
      format: parsed.format,
      holes: parsed.holes,
      maxPlayers: parsed.maxPlayers,
      entryFeeCents: Math.round(parsed.entryFeeDollars * 100),
      description: parsed.description?.trim() || null,
      teamAName:
        parsed.format === "ryder_cup" ? parsed.teamAName?.trim() || null : null,
      teamBName:
        parsed.format === "ryder_cup" ? parsed.teamBName?.trim() || null : null,
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

  if (existing.status !== "draft") {
    return {
      success: false,
      error: "Only draft events can be deleted.",
    };
  }

  await getDb()
    .delete(events)
    .where(and(eq(events.id, id), eq(events.orgId, org.id)));

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
