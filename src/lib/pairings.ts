import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { events, pairingGroups, registrations } from "@/db/schema";

export { getGroupSizeWarning } from "@/lib/event-formats";

export type PairingGroupWithPlayers = {
  id: string;
  label: string;
  teeTime: string | null;
  startingHole: number | null;
  matchType: string | null;
  sortOrder: number;
  scoringCode: string | null;
  players: {
    id: string;
    name: string;
    email: string;
    handicap: string | null;
    paymentStatus: string;
    teamSide: string | null;
  }[];
};

export type EventPairings = {
  groups: PairingGroupWithPlayers[];
  unassigned: {
    id: string;
    name: string;
    email: string;
    handicap: string | null;
    paymentStatus: string;
    teamSide: string | null;
    scoringCode: string | null;
  }[];
};

export async function getEventPairings(
  eventId: string,
  orgId: string
): Promise<EventPairings | null> {
  const event = await getDb().query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.orgId, orgId)),
  });

  if (!event) return null;

  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
    orderBy: [asc(pairingGroups.sortOrder), asc(pairingGroups.createdAt)],
    with: {
      registrations: {
        orderBy: (registrations, { asc: ascOrder }) => [ascOrder(registrations.name)],
      },
    },
  });

  const unassigned = await getDb().query.registrations.findMany({
    where: and(
      eq(registrations.eventId, eventId),
      isNull(registrations.pairingGroupId)
    ),
    orderBy: (registrations, { asc: ascOrder }) => [ascOrder(registrations.name)],
  });

  return {
    groups: groups.map((group) => ({
      id: group.id,
      label: group.label,
      teeTime: group.teeTime,
      startingHole: group.startingHole,
      matchType: group.matchType,
      sortOrder: group.sortOrder,
      scoringCode: group.scoringCode,
      players: group.registrations.map((reg) => ({
        id: reg.id,
        name: reg.name,
        email: reg.email,
        handicap: reg.handicap,
        paymentStatus: reg.paymentStatus,
        teamSide: reg.teamSide,
      })),
    })),
    unassigned: unassigned.map((reg) => ({
      id: reg.id,
      name: reg.name,
      email: reg.email,
      handicap: reg.handicap,
      paymentStatus: reg.paymentStatus,
      teamSide: reg.teamSide,
      scoringCode: reg.scoringCode,
    })),
  };
}

export async function getRegistrationsForExport(eventId: string, orgId: string) {
  const event = await getDb().query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.orgId, orgId)),
  });

  if (!event) return null;

  return getDb().query.registrations.findMany({
    where: eq(registrations.eventId, eventId),
    orderBy: (registrations, { asc: ascOrder }) => [ascOrder(registrations.name)],
    with: {
      pairingGroup: true,
    },
  });
}
