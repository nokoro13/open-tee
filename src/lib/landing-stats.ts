import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { events, golfCourses, registrations } from "@/db/schema";

export type LandingPageStat = {
  value: string;
  label: string;
};

export type LandingPageStats = {
  eventsHosted: number;
  playersRegistered: number;
  coursesMapped: number;
  regionsRepresented: number;
};

function formatStatValue(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions.toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (value >= 10_000) {
    return `${Math.round(value / 1_000)}K`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return value.toLocaleString("en-US");
}

export function landingStatsToDisplay(stats: LandingPageStats): LandingPageStat[] {
  return [
    {
      value: formatStatValue(stats.eventsHosted),
      label: "Events hosted",
    },
    {
      value: formatStatValue(stats.playersRegistered),
      label: "Players registered",
    },
    {
      value: formatStatValue(stats.coursesMapped),
      label: "Courses mapped",
    },
    {
      value: formatStatValue(stats.regionsRepresented),
      label: "States & provinces",
    },
  ];
}

function normalizeRegion(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

async function countRegionsRepresented(): Promise<number> {
  const db = getDb();

  const [eventStates, courseStates] = await Promise.all([
    db
      .selectDistinct({ state: events.courseState })
      .from(events)
      .where(inArray(events.status, ["published", "closed", "archived"])),
    db
      .selectDistinct({ state: golfCourses.state })
      .from(golfCourses)
      .where(
        and(
          eq(golfCourses.onboardingStatus, "verified"),
          eq(golfCourses.status, "published")
        )
      ),
  ]);

  const regions = new Set<string>();

  for (const row of eventStates) {
    const region = normalizeRegion(row.state);
    if (region) regions.add(region);
  }

  for (const row of courseStates) {
    const region = normalizeRegion(row.state);
    if (region) regions.add(region);
  }

  return regions.size;
}

export async function getLandingPageStats(): Promise<LandingPageStats> {
  const db = getDb();

  const [[eventsRow], [playersRow], [coursesRow], regionsRepresented] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(inArray(events.status, ["published", "closed", "archived"])),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(registrations)
        .where(
          inArray(registrations.paymentStatus, ["pending", "paid", "comped"])
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(golfCourses)
        .where(
          and(
            eq(golfCourses.onboardingStatus, "verified"),
            eq(golfCourses.status, "published")
          )
        ),
      countRegionsRepresented(),
    ]);

  return {
    eventsHosted: eventsRow?.count ?? 0,
    playersRegistered: playersRow?.count ?? 0,
    coursesMapped: coursesRow?.count ?? 0,
    regionsRepresented,
  };
}
