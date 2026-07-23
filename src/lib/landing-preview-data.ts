import type { Event, EventHole } from "@/db/schema";
import type { LeaderboardEntry } from "@/lib/scoring";
import type { LeaderboardScorecard } from "@/lib/leaderboard-scorecard";
import type {
  PrintableScorecard,
  PrintableScorecardEvent,
} from "@/lib/printable-scorecard";
import type { ScorecardHoleSnapshot } from "@/lib/scorecard";

export const PREVIEW_ORG_NAME = "Riverside Golf Club";
export const PREVIEW_SLUG = "spring-charity-scramble";

const previewTimestamp = new Date("2026-01-15T12:00:00Z");

function baseEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "preview-event-1",
    orgId: "preview-org",
    slug: PREVIEW_SLUG,
    name: "Spring Charity Scramble",
    date: "2026-05-16",
    courseName: "Pine Valley Golf Club",
    externalCourseId: null,
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
    nineSide: null,
    format: "scramble",
    holes: "18",
    maxPlayers: 144,
    entryFeeCents: 12500,
    platformTier: "pro",
    logoUrl: null,
    coverImageUrl: null,
    primaryColor: null,
    accentColor: null,
    waitlistEnabled: true,
    groupRegistrationEnabled: true,
    maxGroupSize: 4,
    smsRemindersEnabled: true,
    earlyBirdFeeCents: null,
    earlyBirdEndsAt: null,
    status: "published",
    description:
      "Join us for our annual charity outing supporting local youth golf programs. Lunch, awards, and a silent auction included.",
    registrationOpens: null,
    registrationCloses: null,
    registrationFinalizedAt: previewTimestamp,
    pairingsFinalizedAt: previewTimestamp,
    scorecardsReadyAt: previewTimestamp,
    platformPaidAt: previewTimestamp,
    reminderSentAt: null,
    smsReminderSentAt: null,
    stripePlatformSessionId: null,
    scoringStatus: "open",
    scoringCode: "MARSH1",
    scoringFinalizedAt: null,
    teamAName: null,
    teamBName: null,
    startFormat: "shotgun",
    shotgunStartTime: "8:00 AM",
    firstTeeTime: null,
    teeTimeIntervalMinutes: 10,
    createdAt: previewTimestamp,
    updatedAt: previewTimestamp,
    ...overrides,
  };
}

export const previewDashboardEvents: Event[] = [
  baseEvent({
    id: "preview-event-1",
    name: "Spring Charity Scramble",
    date: "2026-07-22",
    courseName: "Pine Valley Golf Club",
    format: "scramble",
    maxPlayers: 144,
    entryFeeCents: 12500,
    status: "published",
    scoringStatus: "open",
    startFormat: "shotgun",
    shotgunStartTime: "8:00 AM",
  }),
  baseEvent({
    id: "preview-event-2",
    name: "Member-Guest Best Ball",
    date: "2026-08-09",
    courseName: "Riverside Golf Club",
    format: "best_ball",
    maxPlayers: 72,
    entryFeeCents: 8500,
    status: "published",
    scoringStatus: "disabled",
    startFormat: "tee_times",
    firstTeeTime: "7:30 AM",
    teeTimeIntervalMinutes: 8,
  }),
  baseEvent({
    id: "preview-event-3",
    name: "Club Championship Qualifier",
    date: "2026-09-14",
    courseName: "Oakmont Country Club",
    format: "stroke",
    maxPlayers: 36,
    entryFeeCents: 0,
    status: "draft",
    scoringStatus: "disabled",
  }),
  baseEvent({
    id: "preview-event-4",
    name: "Fall Classic Stableford",
    date: "2025-10-18",
    courseName: "Pebble Beach Golf Links",
    format: "stableford",
    maxPlayers: 120,
    entryFeeCents: 25000,
    status: "published",
    scoringStatus: "finalized",
    startFormat: "shotgun",
    shotgunStartTime: "9:00 AM",
  }),
];

export const previewDashboardRegistrationCounts: Record<string, number> = {
  "preview-event-1": 98,
  "preview-event-2": 54,
  "preview-event-4": 120,
};

const previewScorecardHoles: ScorecardHoleSnapshot[] = Array.from(
  { length: 18 },
  (_, index) => {
    const white = 350 + index * 12;
    return {
      holeNumber: index + 1,
      par: index % 5 === 0 ? 5 : index % 3 === 0 ? 3 : 4,
      yardage: white,
      strokeIndex: index + 1,
      yardagesByTee: {
        black: white + 55,
        blue: white + 30,
        white,
        red: Math.max(white - 45, 90),
      },
    };
  }
);

export const previewRegistrationEvent = {
  organization: { name: PREVIEW_ORG_NAME },
  event: baseEvent(),
  registrationCount: 98,
  spotsLeft: 46,
  soldOut: false,
  registrationClosed: false,
};

export const previewDraftEvent: Event = baseEvent({
  id: "preview-draft-event",
  slug: "summer-member-guest",
  name: "Summer Member-Guest",
  date: "2026-08-09",
  courseName: "Riverside Golf Club",
  format: "best_ball",
  maxPlayers: 72,
  entryFeeCents: 15000,
  status: "draft",
  scoringStatus: "disabled",
  description:
    "Two-person best ball with gross and net flights. Dinner and awards follow on the patio.",
  startFormat: "shotgun",
  shotgunStartTime: "8:30 AM",
});

export const previewEventWizardInitialValues = {
  name: previewDraftEvent.name,
  date: previewDraftEvent.date,
  format: previewDraftEvent.format,
  holes: previewDraftEvent.holes,
  maxPlayers: previewDraftEvent.maxPlayers,
  entryFeeDollars: previewDraftEvent.entryFeeCents / 100,
  description: previewDraftEvent.description ?? "",
  courseSelection: {
    courseName: previewDraftEvent.courseName ?? "Riverside Golf Club",
    externalCourseId: null,
    nineSide: null,
    scorecardHoles: previewScorecardHoles,
    courseAddress: "1200 Riverside Dr",
    courseCity: "Augusta",
    courseState: "GA",
    coursePhone: "(706) 555-0142",
    courseWebsite: null,
    selectedTeeKey: "white",
    teeName: "White",
    courseRating: "72.4",
    courseSlope: 131,
    courseTotalYardage: 6820,
  },
  startFormatValues: {
    startFormat: "shotgun" as const,
    shotgunStartTime: "8:30 AM",
    firstTeeTime: "7:30 AM",
    teeTimeIntervalMinutes: 10,
  },
};

export const previewDraftEventHoles: EventHole[] = Array.from(
  { length: 18 },
  (_, index) => ({
    id: `preview-hole-${index + 1}`,
    eventId: "preview-draft-event",
    holeNumber: index + 1,
    par: index % 5 === 0 ? 5 : index % 3 === 0 ? 3 : 4,
    yardage: 350 + index * 12,
    strokeIndex: index + 1,
    createdAt: previewTimestamp,
  })
);

const previewLeaderboardHoles = previewDraftEventHoles.map((hole) => ({
  holeNumber: hole.holeNumber,
  par: hole.par,
  strokeIndex: hole.strokeIndex,
}));

function buildPreviewScorecard(
  playerRows: LeaderboardScorecard["playerRows"],
  summaryRow?: LeaderboardScorecard["summaryRow"]
): LeaderboardScorecard {
  return {
    holes: previewLeaderboardHoles,
    playerRows,
    summaryRow,
  };
}

const previewJordanScores = [4, 3, 5, 4, 3, 4, 5, 3, 4, 4, 3, 5, 4, 4];
const previewAlexScores = [5, 4, 4, 4, 4, 3, 4, 4, 5, 5, 4, 4, 5, 3];

export const previewLeaderboardPayload = {
  event: {
    name: "Spring Charity Scramble",
    slug: PREVIEW_SLUG,
    format: "stroke",
    holes: "18",
    scoringStatus: "open",
    courseName: "Pine Valley Golf Club",
  },
  entries: [
    {
      id: "lb-1",
      rank: 1,
      name: "Jordan Smith",
      thru: 14,
      total: 52,
      totalDisplay: "52",
      toPar: -2,
      toParDisplay: "-2",
      isComplete: false,
      scorecard: buildPreviewScorecard(
        [
          {
            id: "lb-1",
            name: "Jordan Smith",
            handicapDisplay: "12",
            grossScores: [
              ...previewJordanScores,
              ...Array.from({ length: 4 }, () => null),
            ],
            strokesReceived: previewLeaderboardHoles.map((hole) =>
              hole.strokeIndex != null && hole.strokeIndex <= 12 ? 1 : 0
            ),
            grossTotal: 52,
          },
        ],
        {
          label: "Net",
          scores: previewLeaderboardHoles.map((hole, index) => {
            const gross = previewJordanScores[index];
            if (gross == null) return null;
            const stroke =
              hole.strokeIndex != null && hole.strokeIndex <= 12 ? 1 : 0;
            return gross - stroke;
          }),
          total: 40,
          variant: "net",
        }
      ),
    },
    {
      id: "lb-2",
      rank: 2,
      name: "Alex Chen",
      thru: 14,
      total: 53,
      totalDisplay: "53",
      toPar: -1,
      toParDisplay: "-1",
      isComplete: false,
      scorecard: buildPreviewScorecard(
        [
          {
            id: "lb-2",
            name: "Alex Chen",
            handicapDisplay: "8",
            grossScores: [
              ...previewAlexScores,
              ...Array.from({ length: 4 }, () => null),
            ],
            strokesReceived: previewLeaderboardHoles.map((hole) =>
              hole.strokeIndex != null && hole.strokeIndex <= 8 ? 1 : 0
            ),
            grossTotal: 53,
          },
        ],
        {
          label: "Net",
          scores: previewLeaderboardHoles.map((hole, index) => {
            const gross = previewAlexScores[index];
            if (gross == null) return null;
            const stroke =
              hole.strokeIndex != null && hole.strokeIndex <= 8 ? 1 : 0;
            return gross - stroke;
          }),
          total: 45,
          variant: "net",
        }
      ),
    },
    {
      id: "lb-3",
      rank: 3,
      name: "Taylor Brooks",
      thru: 13,
      total: 54,
      totalDisplay: "54",
      toPar: 0,
      toParDisplay: "E",
      isComplete: false,
    },
    {
      id: "lb-4",
      rank: 4,
      name: "Morgan Lee",
      thru: 14,
      total: 55,
      totalDisplay: "55",
      toPar: 1,
      toParDisplay: "+1",
      isComplete: false,
    },
    {
      id: "lb-5",
      rank: 5,
      name: "Casey Rivera",
      thru: 12,
      total: 56,
      totalDisplay: "56",
      toPar: 2,
      toParDisplay: "+2",
      isComplete: false,
    },
  ] satisfies LeaderboardEntry[],
  updatedAt: previewTimestamp.toISOString(),
};

export const previewParByHole: Record<number, number> = Object.fromEntries(
  previewDraftEventHoles.map((hole) => [hole.holeNumber, hole.par])
);

export const PARTNER_CLUBS = [
  "Pine Valley GC",
  "Riverside CC",
  "Oakmont Club",
  "Pebble Beach",
  "Augusta National",
  "St Andrews Links",
] as const;

export const previewPrintableScorecardEvent: PrintableScorecardEvent = {
  id: "preview-event-1",
  slug: PREVIEW_SLUG,
  name: "Spring Charity Scramble",
  courseName: "Pine Valley Golf Club",
  date: "2026-05-16",
  format: "scramble",
  formatLabel: "Scramble",
  holes: "18",
  holeData: previewScorecardHoles,
};

export const previewPrintableScorecard: PrintableScorecard = {
  groupId: "preview-group-1",
  groupLabel: "Group 1 · Hole 1",
  scheduleLine: "8:00 AM · Hole 1 · 05/16/2026",
  scoringCode: "G1SCOR",
  scoringUrl: `https://openround.app/e/${PREVIEW_SLUG}/score?code=G1SCOR`,
  displayScoreUrl: `openround.app/e/${PREVIEW_SLUG}/score`,
  players: [
    {
      id: "preview-player-1",
      name: "Jordan Smith",
      handicap: "12.4",
      courseHandicap: 11,
      strokesByHole: [1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1],
    },
    {
      id: "preview-player-2",
      name: "Alex Chen",
      handicap: "8.2",
      courseHandicap: 8,
      strokesByHole: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
    },
    {
      id: "preview-player-3",
      name: "Taylor Brooks",
      handicap: "18.0",
      courseHandicap: 16,
      strokesByHole: [1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1],
    },
    {
      id: "preview-player-4",
      name: "Morgan Lee",
      handicap: "6.5",
      courseHandicap: 6,
      strokesByHole: [1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
    },
  ],
  showTeamRow: true,
  teamRowLabel: "Team Scramble Score",
  minPlayerRows: 4,
};
