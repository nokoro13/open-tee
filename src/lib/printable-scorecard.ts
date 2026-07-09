import { format, parseISO } from "date-fns";
import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { events, pairingGroups, registrations } from "@/db/schema";
import { getEventFormatLabel, usesTeamLeaderboard } from "@/lib/event-formats";
import { parseCourseHandicap, strokesReceivedOnHole } from "@/lib/handicap-strokes";
import {
  buildMultiTeeHoleSnapshots,
  getOpenGolfCourse,
  STANDARD_SCORECARD_TEE_COLORS,
} from "@/lib/opengolfapi";
import { buildScorecardSnapshot, type ScorecardHoleSnapshot } from "@/lib/scorecard";
import { getGroupScorePageUrl } from "@/lib/scoring-code-storage";
import { formatTimeDisplay } from "@/lib/start-format";

export type PrintableScorecardPlayer = {
  id: string;
  name: string;
  handicap: string | null;
  courseHandicap: number | null;
  strokesByHole: number[];
};

export type PrintableScorecard = {
  groupId: string;
  groupLabel: string;
  scheduleLine: string;
  scoringCode: string;
  scoringUrl: string;
  displayScoreUrl: string;
  players: PrintableScorecardPlayer[];
  showTeamRow: boolean;
  teamRowLabel: string | null;
  minPlayerRows: number;
};

export type PrintableScorecardEvent = {
  id: string;
  slug: string;
  name: string;
  courseName: string;
  courseAddress?: string | null;
  teeName?: string | null;
  courseRating?: string | null;
  courseSlope?: number | null;
  courseTotalYardage?: number | null;
  date: string;
  format: string;
  formatLabel: string;
  holes: "9" | "18";
  holeData: ScorecardHoleSnapshot[];
};

export type PrintableScorecardBundle = {
  event: PrintableScorecardEvent;
  scorecards: PrintableScorecard[];
};

function formatEventDate(dateStr: string): string {
  return format(parseISO(dateStr), "MM/dd/yyyy");
}

function displayScoreUrl(appUrl: string, slug: string): string {
  const base = appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `${base}/e/${slug}/score`;
}

function buildScheduleLine(
  group: {
    teeTime: string | null;
    startingHole: number | null;
  },
  event: {
    date: string;
    startFormat: "shotgun" | "tee_times";
    shotgunStartTime: string | null;
  }
): string {
  const date = formatEventDate(event.date);

  if (event.startFormat === "shotgun") {
    const time = formatTimeDisplay(event.shotgunStartTime);
    const hole =
      group.startingHole != null ? `Hole ${group.startingHole}` : "Shotgun";
    return `${time} · ${hole} · ${date}`;
  }

  const tee = formatTimeDisplay(group.teeTime);
  return `${tee} · ${date}`;
}

function getTeamRowLabel(format: string): string | null {
  if (!usesTeamLeaderboard(format) || format === "ryder_cup") {
    return null;
  }

  switch (format) {
    case "best_ball":
      return "Team Net Best Ball Score";
    case "scramble":
      return "Team Scramble Score";
    case "alternate_shot":
      return "Team Alternate Shot Score";
    case "shamble":
      return "Team Shamble Score";
    default:
      return "Team Score";
  }
}

function buildPlayerStrokes(
  courseHandicap: number | null,
  holeData: ScorecardHoleSnapshot[]
): number[] {
  const holeCount = holeData.length;
  if (courseHandicap == null || courseHandicap <= 0) {
    return Array.from({ length: holeCount }, () => 0);
  }

  return holeData.map((hole) =>
    strokesReceivedOnHole(
      courseHandicap,
      hole.strokeIndex ?? hole.holeNumber,
      holeCount
    )
  );
}

async function resolveHoleData(
  event: {
    externalCourseId: string | null;
    holes: "9" | "18";
    nineSide: "front" | "back" | null;
    eventHoles: {
      holeNumber: number;
      par: number;
      yardage: number | null;
      strokeIndex: number | null;
    }[];
  }
): Promise<ScorecardHoleSnapshot[]> {
  const holeCount = event.holes === "18" ? 18 : 9;
  let holeData: ScorecardHoleSnapshot[] =
    event.eventHoles.length > 0
      ? event.eventHoles.map((hole) => ({
          holeNumber: hole.holeNumber,
          par: hole.par,
          yardage: hole.yardage,
          strokeIndex: hole.strokeIndex,
        }))
      : [];

  if (event.externalCourseId) {
    try {
      const course = await getOpenGolfCourse(event.externalCourseId);
      const fromApi =
        course?.holes_data?.length
          ? buildMultiTeeHoleSnapshots(course.holes_data, {
              holes: event.holes,
              nineSide: event.nineSide,
            })
          : course?.scorecard?.length
            ? buildScorecardSnapshot(course.scorecard, {
                holes: event.holes,
                nineSide: event.nineSide,
              })
            : [];

      if (fromApi.length > 0) {
        if (holeData.length === 0) {
          holeData = fromApi;
        } else {
          holeData = holeData.map((hole) => {
            const apiHole = fromApi.find(
              (entry) => entry.holeNumber === hole.holeNumber
            );
            return {
              ...hole,
              yardage: hole.yardage ?? apiHole?.yardage ?? null,
              strokeIndex: hole.strokeIndex ?? apiHole?.strokeIndex ?? null,
              yardagesByTee: apiHole?.yardagesByTee ?? hole.yardagesByTee,
            };
          });
        }
      }
    } catch {
      // Keep stored hole data when the course API is unavailable.
    }
  }

  if (holeData.length > 0) {
    holeData = holeData.map((hole) => {
      if (hole.yardagesByTee) return hole;
      const fallbackYardage = hole.yardage ?? null;
      return {
        ...hole,
        yardagesByTee: Object.fromEntries(
          STANDARD_SCORECARD_TEE_COLORS.map((color) => [
            color,
            color === "white" ? fallbackYardage : null,
          ])
        ),
      };
    });
  }

  if (holeData.length === 0) {
    holeData = Array.from({ length: holeCount }, (_, index) => ({
      holeNumber: index + 1,
      par: 4,
      yardage: null,
      strokeIndex: null,
    }));
  }

  return holeData;
}

function buildScorecard(
  group: {
    id: string;
    label: string;
    teeTime: string | null;
    startingHole: number | null;
    scoringCode: string | null;
    registrations: {
      id: string;
      name: string;
      handicap: string | null;
      paymentStatus: string;
    }[];
  },
  event: {
    slug: string;
    date: string;
    format: string;
    holes: "9" | "18";
    startFormat: "shotgun" | "tee_times";
    shotgunStartTime: string | null;
  },
  appUrl: string,
  holeData: ScorecardHoleSnapshot[]
): PrintableScorecard | null {
  const activePlayers = group.registrations.filter(
    (player) => player.paymentStatus !== "refunded"
  );

  if (activePlayers.length === 0 || !group.scoringCode) {
    return null;
  }

  const teamRowLabel = getTeamRowLabel(event.format);

  return {
    groupId: group.id,
    groupLabel: group.label,
    scheduleLine: buildScheduleLine(group, event),
    scoringCode: group.scoringCode,
    scoringUrl: getGroupScorePageUrl(appUrl, event.slug, group.scoringCode),
    displayScoreUrl: displayScoreUrl(appUrl, event.slug),
    players: activePlayers.map((player) => {
      const courseHandicap = parseCourseHandicap(player.handicap);
      return {
        id: player.id,
        name: player.name,
        handicap: player.handicap,
        courseHandicap,
        strokesByHole: buildPlayerStrokes(courseHandicap, holeData),
      };
    }),
    showTeamRow: teamRowLabel != null,
    teamRowLabel,
    minPlayerRows: Math.max(activePlayers.length, 4),
  };
}

export async function getPrintableScorecardBundle(
  eventId: string,
  orgId: string,
  appUrl: string,
  options?: { groupId?: string }
): Promise<PrintableScorecardBundle | null> {
  const event = await getDb().query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.orgId, orgId)),
    with: {
      eventHoles: {
        orderBy: (eventHoles, { asc: ascOrder }) => [ascOrder(eventHoles.holeNumber)],
      },
      pairingGroups: {
        orderBy: [asc(pairingGroups.sortOrder), asc(pairingGroups.createdAt)],
        with: {
          registrations: {
            orderBy: (regs, { asc: ascOrder }) => [ascOrder(regs.name)],
          },
        },
      },
    },
  });

  if (!event) return null;

  const holeData = await resolveHoleData(event);

  const groups = options?.groupId
    ? event.pairingGroups.filter((group) => group.id === options.groupId)
    : event.pairingGroups;

  let scorecards = groups
    .map((group) => buildScorecard(group, event, appUrl, holeData))
    .filter((card): card is PrintableScorecard => card != null);

  if (options?.groupId && scorecards.length === 0) {
    const soloPlayer = await getDb().query.registrations.findFirst({
      where: and(
        eq(registrations.eventId, eventId),
        eq(registrations.id, options.groupId),
        isNull(registrations.pairingGroupId)
      ),
    });

    if (soloPlayer && soloPlayer.paymentStatus !== "refunded" && soloPlayer.scoringCode) {
      const soloCard = buildScorecard(
        {
          id: soloPlayer.id,
          label: soloPlayer.name,
          teeTime: null,
          startingHole: null,
          scoringCode: soloPlayer.scoringCode,
          registrations: [
            {
              id: soloPlayer.id,
              name: soloPlayer.name,
              handicap: soloPlayer.handicap,
              paymentStatus: soloPlayer.paymentStatus,
            },
          ],
        },
        event,
        appUrl,
        holeData
      );

      if (soloCard) {
        scorecards = [soloCard];
      }
    }
  }

  if (options?.groupId && scorecards.length === 0) {
    return null;
  }

  if (!options?.groupId) {
    const unassigned = await getDb().query.registrations.findMany({
      where: and(
        eq(registrations.eventId, eventId),
        isNull(registrations.pairingGroupId)
      ),
      orderBy: [asc(registrations.name)],
    });

    for (const player of unassigned) {
      if (player.paymentStatus === "refunded" || !player.scoringCode) continue;

      const soloCard = buildScorecard(
        {
          id: player.id,
          label: player.name,
          teeTime: null,
          startingHole: null,
          scoringCode: player.scoringCode,
          registrations: [
            {
              id: player.id,
              name: player.name,
              handicap: player.handicap,
              paymentStatus: player.paymentStatus,
            },
          ],
        },
        event,
        appUrl,
        holeData
      );

      if (soloCard) {
        scorecards.push(soloCard);
      }
    }
  }

  return {
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      courseName: event.courseName,
      courseAddress: event.courseAddress,
      teeName: event.teeName,
      courseRating: event.courseRating,
      courseSlope: event.courseSlope,
      courseTotalYardage: event.courseTotalYardage,
      date: event.date,
      format: event.format,
      formatLabel: getEventFormatLabel(event.format),
      holes: event.holes,
      holeData,
    },
    scorecards,
  };
}

export function sumRange(
  holes: ScorecardHoleSnapshot[],
  start: number,
  end: number,
  field: "par" | "yardage",
  teeColor?: string
): number | null {
  let total = 0;
  let hasValue = false;

  for (const hole of holes) {
    if (hole.holeNumber < start || hole.holeNumber > end) continue;
    const value =
      field === "par"
        ? hole.par
        : teeColor
          ? hole.yardagesByTee?.[teeColor] ?? null
          : hole.yardage;
    if (value == null) continue;
    total += value;
    hasValue = true;
  }

  return hasValue ? total : null;
}

export function getHoleValue(
  holes: ScorecardHoleSnapshot[],
  holeNumber: number,
  field: "par" | "yardage" | "strokeIndex",
  teeColor?: string
): number | null {
  const hole = holes.find((entry) => entry.holeNumber === holeNumber);
  if (!hole) return null;
  if (field === "par") return hole.par;
  if (field === "yardage") {
    if (teeColor) return hole.yardagesByTee?.[teeColor] ?? null;
    return hole.yardage ?? null;
  }
  return hole.strokeIndex ?? null;
}

export { STANDARD_SCORECARD_TEE_COLORS };
