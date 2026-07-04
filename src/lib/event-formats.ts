export type FormatCategory = "team" | "individual" | "match";

export type EntryMode = "team_hole" | "individual_hole";

export type LeaderboardMode =
  | "individual_stroke"
  | "team_stroke"
  | "team_best_ball"
  | "stableford"
  | "match"
  | "ryder_cup";

export type SortDirection = "asc" | "desc";

export type RyderMatchType = "singles" | "fourball" | "foursomes";

export type TeamSide = "a" | "b";

export const RYDER_MATCH_TYPES = [
  {
    value: "singles" as const,
    label: "Singles",
    description: "1 vs 1 — lowest score wins each hole.",
    minPerSide: 1,
    maxPerSide: 1,
  },
  {
    value: "fourball" as const,
    label: "Fourball",
    description: "2 vs 2 best ball — best score per side wins the hole.",
    minPerSide: 1,
    maxPerSide: 2,
  },
  {
    value: "foursomes" as const,
    label: "Foursomes",
    description: "2 vs 2 alternate shot — one team score per side per hole.",
    minPerSide: 1,
    maxPerSide: 2,
  },
] as const;

export const EVENT_FORMATS = [
  {
    value: "scramble",
    label: "Scramble",
    description: "All players hit, team plays the best shot.",
    category: "team",
    entryMode: "team_hole",
    leaderboardMode: "team_stroke",
    sortDirection: "asc",
    defaultGroupSize: 4,
    minGroupSize: 2,
    maxGroupSize: 4,
    preferredGroupSize: 4,
    totalColumnLabel: "Total",
    entityColumnLabel: "Team",
    showToPar: true,
  },
  {
    value: "best_ball",
    label: "Best ball",
    description: "Each player plays their own ball; team counts the best score per hole.",
    category: "team",
    entryMode: "individual_hole",
    leaderboardMode: "team_best_ball",
    sortDirection: "asc",
    defaultGroupSize: 4,
    minGroupSize: 2,
    maxGroupSize: 4,
    totalColumnLabel: "Total",
    entityColumnLabel: "Team",
    showToPar: true,
  },
  {
    value: "alternate_shot",
    label: "Alternate shot",
    description: "Partners alternate shots on each hole (foursomes).",
    category: "team",
    entryMode: "team_hole",
    leaderboardMode: "team_stroke",
    sortDirection: "asc",
    defaultGroupSize: 2,
    minGroupSize: 2,
    maxGroupSize: 2,
    totalColumnLabel: "Total",
    entityColumnLabel: "Team",
    showToPar: true,
  },
  {
    value: "shamble",
    label: "Shamble",
    description: "Best drive, then each player plays their own ball; best score counts.",
    category: "team",
    entryMode: "individual_hole",
    leaderboardMode: "team_best_ball",
    sortDirection: "asc",
    defaultGroupSize: 4,
    minGroupSize: 2,
    maxGroupSize: 4,
    totalColumnLabel: "Total",
    entityColumnLabel: "Team",
    showToPar: true,
  },
  {
    value: "stroke",
    label: "Stroke play",
    description: "Individual stroke play — lowest total wins.",
    category: "individual",
    entryMode: "individual_hole",
    leaderboardMode: "individual_stroke",
    sortDirection: "asc",
    defaultGroupSize: 4,
    minGroupSize: 1,
    maxGroupSize: 4,
    totalColumnLabel: "Total",
    entityColumnLabel: "Player",
    showToPar: true,
  },
  {
    value: "stableford",
    label: "Stableford",
    description: "Points per hole based on score vs par — highest total wins.",
    category: "individual",
    entryMode: "individual_hole",
    leaderboardMode: "stableford",
    sortDirection: "desc",
    defaultGroupSize: 4,
    minGroupSize: 1,
    maxGroupSize: 4,
    totalColumnLabel: "Points",
    entityColumnLabel: "Player",
    showToPar: false,
  },
  {
    value: "match_play",
    label: "Match play",
    description: "USGA singles match play — most holes won wins the match.",
    category: "match",
    entryMode: "individual_hole",
    leaderboardMode: "match",
    sortDirection: "desc",
    defaultGroupSize: 2,
    minGroupSize: 2,
    maxGroupSize: 2,
    totalColumnLabel: "Status",
    entityColumnLabel: "Match",
    showToPar: false,
  },
  {
    value: "head_to_head",
    label: "Head to head",
    description:
      "USGA singles match play — two players compete hole by hole; most holes won wins the match.",
    category: "match",
    entryMode: "individual_hole",
    leaderboardMode: "match",
    sortDirection: "desc",
    defaultGroupSize: 2,
    minGroupSize: 2,
    maxGroupSize: 2,
    totalColumnLabel: "Status",
    entityColumnLabel: "Match",
    showToPar: false,
  },
  {
    value: "ryder_cup",
    label: "Ryder Cup",
    description:
      "Two teams compete in singles, fourball, and foursomes — most match points wins.",
    category: "match",
    entryMode: "individual_hole",
    leaderboardMode: "ryder_cup",
    sortDirection: "desc",
    defaultGroupSize: 2,
    minGroupSize: 2,
    maxGroupSize: 4,
    totalColumnLabel: "Status",
    entityColumnLabel: "Match",
    showToPar: false,
    requiresTeamConfig: true,
    requiresTeamSides: true,
    requiresMatchType: true,
  },
] as const;

export type EventFormat = (typeof EVENT_FORMATS)[number]["value"];

export type EventFormatMeta = (typeof EVENT_FORMATS)[number];

const formatMap = new Map<EventFormat, EventFormatMeta>(
  EVENT_FORMATS.map((format) => [format.value, format])
);

export function getEventFormat(value: string): EventFormatMeta | undefined {
  return formatMap.get(value as EventFormat);
}

export function getEventFormatLabel(value: string): string {
  return getEventFormat(value)?.label ?? value.replace(/_/g, " ");
}

export function getLeaderboardMode(format: string): LeaderboardMode {
  return getEventFormat(format)?.leaderboardMode ?? "individual_stroke";
}

export function isMatchPlayFormat(format: string): boolean {
  return getLeaderboardMode(format) === "match";
}

export function getSortDirection(format: string): SortDirection {
  return getEventFormat(format)?.sortDirection ?? "asc";
}

export function getTotalColumnLabel(format: string): string {
  return getEventFormat(format)?.totalColumnLabel ?? "Total";
}

export function getEntityColumnLabel(format: string): string {
  return getEventFormat(format)?.entityColumnLabel ?? "Player";
}

export function formatShowsToPar(format: string): boolean {
  return getEventFormat(format)?.showToPar ?? true;
}

export function isTeamHoleScoring(
  format: string,
  matchType?: string | null
): boolean {
  if (format === "ryder_cup" && matchType === "foursomes") {
    return true;
  }
  return getEventFormat(format)?.entryMode === "team_hole";
}

export function isIndividualHoleScoring(
  format: string,
  matchType?: string | null
): boolean {
  return !isTeamHoleScoring(format, matchType);
}

export function usesTeamLeaderboard(format: string): boolean {
  const mode = getLeaderboardMode(format);
  return mode === "team_stroke" || mode === "team_best_ball";
}

export function requiresTeamConfig(format: string): boolean {
  return format === "ryder_cup";
}

export function requiresTeamSides(format: string): boolean {
  return format === "ryder_cup";
}

export function requiresMatchType(format: string): boolean {
  return format === "ryder_cup";
}

export function getRyderMatchType(value: string | null | undefined) {
  return RYDER_MATCH_TYPES.find((type) => type.value === value);
}

export function getGroupSizeWarning(
  format: string,
  playerCount: number,
  options?: {
    matchType?: string | null;
    teamACount?: number;
    teamBCount?: number;
  }
): string | null {
  const meta = getEventFormat(format);
  if (!meta || playerCount === 0) return null;

  if (format === "ryder_cup") {
    const matchType = getRyderMatchType(options?.matchType ?? null);
    if (!options?.matchType) {
      return "Set a match type (singles, fourball, or foursomes) for this match.";
    }
    if (matchType) {
      const a = options.teamACount ?? 0;
      const b = options.teamBCount ?? 0;
      if (a === 0 || b === 0) {
        return "Assign at least one player to each team for this match.";
      }
      if (a > matchType.maxPerSide || b > matchType.maxPerSide) {
        return `${matchType.label} allows at most ${matchType.maxPerSide} player(s) per team.`;
      }
      if (playerCount < 2) {
        return "Ryder Cup matches need at least 2 players (one per team).";
      }
    }
    return null;
  }

  if (playerCount < meta.minGroupSize) {
    return `${meta.label} groups should have at least ${meta.minGroupSize} player${meta.minGroupSize === 1 ? "" : "s"} (${playerCount} assigned).`;
  }

  if (playerCount > meta.maxGroupSize) {
    return `${meta.label} groups should have at most ${meta.maxGroupSize} players (${playerCount} assigned).`;
  }

  if (
    "preferredGroupSize" in meta &&
    meta.preferredGroupSize &&
    playerCount !== meta.preferredGroupSize
  ) {
    return `${meta.label} groups are usually ${meta.preferredGroupSize} players (${playerCount} assigned).`;
  }

  return null;
}

export function getScoreEntrySubtitle(
  format: string,
  matchType?: string | null
): string {
  const meta = getEventFormat(format);
  if (!meta) return "Scoring";

  if (format === "ryder_cup") {
    const type = getRyderMatchType(matchType ?? null);
    if (type?.value === "foursomes") {
      return `Ryder Cup · ${type.label} · team score per side`;
    }
    if (type) {
      return `Ryder Cup · ${type.label} · individual scores`;
    }
    return "Ryder Cup · set match type in pairings";
  }

  if (meta.entryMode === "team_hole") {
    return `${meta.label} · team score per hole`;
  }

  if (meta.leaderboardMode === "stableford") {
    return `${meta.label} · strokes converted to points`;
  }

  if (meta.leaderboardMode === "match") {
    return `${meta.label} · individual scores (holes won decide match)`;
  }

  if (meta.leaderboardMode === "team_best_ball") {
    return `${meta.label} · individual scores (best per hole counts)`;
  }

  return `${meta.label} · individual scores`;
}

export const EVENT_FORMAT_OPTIONS = EVENT_FORMATS.map(
  ({ value, label, description, category }) => ({
    value,
    label,
    description,
    category,
  })
);

export const FORMAT_CATEGORIES = [
  { id: "team", label: "Team formats" },
  { id: "individual", label: "Individual formats" },
  { id: "match", label: "Match formats" },
] as const;

export const DEFAULT_TEAM_A_NAME = "Team A";
export const DEFAULT_TEAM_B_NAME = "Team B";
