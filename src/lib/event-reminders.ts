import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { events, registrations } from "@/db/schema";
import { sendEventReminderEmail } from "@/lib/email";
import { sendEventReminderSms } from "@/lib/sms";
import { canUseProFeature } from "@/lib/platform-tier";
import { getAppUrl } from "@/lib/stripe";

export type ReminderRunResult = {
  eventsProcessed: number;
  emailsSent: number;
  smsSent: number;
  errors: string[];
};

function tomorrowDateString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function sendEventRemindersForTomorrow(): Promise<ReminderRunResult> {
  const targetDate = tomorrowDateString();
  const appUrl = getAppUrl();

  const upcomingEvents = await getDb().query.events.findMany({
    where: and(
      eq(events.date, targetDate),
      inArray(events.status, ["published", "closed"]),
      isNull(events.reminderSentAt)
    ),
  });

  const result: ReminderRunResult = {
    eventsProcessed: 0,
    emailsSent: 0,
    smsSent: 0,
    errors: [],
  };

  for (const event of upcomingEvents) {
    result.eventsProcessed += 1;

    const players = await getDb().query.registrations.findMany({
      where: and(
        eq(registrations.eventId, event.id),
        inArray(registrations.paymentStatus, ["paid", "comped"])
      ),
    });

    if (players.length === 0) {
      await getDb()
        .update(events)
        .set({ reminderSentAt: new Date(), updatedAt: new Date() })
        .where(eq(events.id, event.id));
      continue;
    }

    const eventUrl = `${appUrl}/e/${event.slug}`;
    let eventHadErrors = false;

    for (const player of players) {
      try {
        await sendEventReminderEmail({
          to: player.email,
          playerName: player.name,
          eventName: event.name,
          eventDate: event.date,
          courseName: event.courseName,
          eventUrl,
        });
        result.emailsSent += 1;
      } catch (error) {
        eventHadErrors = true;
        result.errors.push(
          `${event.slug}/${player.email}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      if (
        canUseProFeature(event, "sms_reminders") &&
        event.smsRemindersEnabled &&
        player.smsOptIn &&
        player.phone
      ) {
        const smsResult = await sendEventReminderSms({
          to: player.phone,
          playerName: player.name,
          eventName: event.name,
          eventDate: event.date,
          eventUrl,
        });

        if (smsResult.success) {
          result.smsSent += 1;
        } else if (!smsResult.skipped) {
          eventHadErrors = true;
          result.errors.push(
            `${event.slug}/${player.phone}: ${smsResult.error}`
          );
        }
      }
    }

    if (!eventHadErrors) {
      await getDb()
        .update(events)
        .set({ reminderSentAt: new Date(), updatedAt: new Date() })
        .where(eq(events.id, event.id));
    }
  }

  return result;
}

/** Count events eligible for reminder on the next cron run (for admin/debug). */
export async function countPendingReminderEvents(): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.date, tomorrowDateString()),
        inArray(events.status, ["published", "closed"]),
        isNull(events.reminderSentAt)
      )
    );

  return row?.count ?? 0;
}
