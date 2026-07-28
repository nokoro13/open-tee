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
    description:
      "Teams of 2–4; each player plays their own ball and the best score per hole counts.",
    category: "team",
    entryMode: "individual_hole",
    leaderboardMode: "team_best_ball",
    sortDirection: "asc",
    defaultGroupSize: 4,
    minGroupSize: 2,
    maxGroupSize: 4,
    preferredGroupSize: 4,
    totalColumnLabel: "Total",
    entityColumnLabel: "Team",
    showToPar: true,
    requiresTeamConfig: true,
    requiresTeamSides: true,
  },
  {
    value: "alternate_shot",
    label: "Alternate shot",
    description: "Teammates alternate shots on each hole (foursomes).",
    category: "team",
    entryMode: "team_hole",
    leaderboardMode: "team_stroke",
    sortDirection: "asc",
    defaultGroupSize: 2,
    minGroupSize: 2,
    maxGroupSize: 4,
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
  return format === "ryder_cup" || format === "best_ball";
}

export function isTeamFormat(format: string): boolean {
  return getEventFormat(format)?.category === "team";
}

export const TEAM_SIZE_OPTIONS = [2, 3, 4] as const;

export type TeamSizeOption = (typeof TEAM_SIZE_OPTIONS)[number];

export function getDefaultTeamSize(format: string): TeamSizeOption | null {
  if (!isTeamFormat(format)) return null;
  return format === "best_ball" || format === "alternate_shot" ? 2 : 4;
}

/**
 * Resolves the team size for an event. Only team formats have a team size;
 * events created before team size was configurable fall back to the format's
 * historical default (2 for best ball / alternate shot, 4 for scramble /
 * shamble) so existing data keeps behaving the same way.
 */
function normalizeTeamSize(
  teamSize: number | null | undefined
): TeamSizeOption | null {
  if (teamSize == null) return null;
  const value = Number(teamSize);
  if (value === 2 || value === 3 || value === 4) return value;
  return null;
}

export function getEffectiveTeamSize(
  format: string,
  teamSize: number | null | undefined
): TeamSizeOption | null {
  if (!isTeamFormat(format)) return null;
  const normalized = normalizeTeamSize(teamSize);
  if (normalized != null) return normalized;
  return getDefaultTeamSize(format);
}

/** How teams are arranged inside a pairing group (groups max at 4 players). */
export type TeamGroupLayout = "split" | "single";

export function getTeamGroupLayout(
  format: string,
  teamSize?: number | null
): TeamGroupLayout | null {
  if (!isTeamFormat(format)) return null;
  const effective = getEffectiveTeamSize(format, teamSize);
  if (effective === 2) return "split";
  if (effective === 3 || effective === 4) return "single";
  return null;
}

export function usesTeamGroupLayout(
  format: string,
  teamSize?: number | null
): boolean {
  return getTeamGroupLayout(format, teamSize) != null;
}

export function getTeamSizeLabel(teamSize: number): string {
  return teamSize === 2
    ? "Teams of 2 — two teams can share a group of 4"
    : `Teams of ${teamSize} — one team per group`;
}

/**
 * Groups max out at 4 players, so two teams can only share a group when
 * teams have 2 players. That is when a/b team sides come into play.
 */
export function usesPairSides(
  format: string,
  teamSize?: number | null
): boolean {
  return isTeamFormat(format) && getEffectiveTeamSize(format, teamSize) === 2;
}

export function requiresTeamSides(
  format: string,
  teamSize?: number | null
): boolean {
  return format === "ryder_cup" || usesPairSides(format, teamSize);
}

/** Max players a pairing group can hold for the given format + team size. */
export function getMaxGroupPlayers(
  format: string,
  teamSize?: number | null
): number {
  const effective = getEffectiveTeamSize(format, teamSize);
  if (effective != null) {
    return effective === 2 ? 4 : effective;
  }
  return getEventFormat(format)?.maxGroupSize ?? 4;
}

export const DEFAULT_PAIR_A_LABEL = "Team 1";
export const DEFAULT_PAIR_B_LABEL = "Team 2";

export function getPairSideLabel(side: "a" | "b"): string {
  return side === "a" ? DEFAULT_PAIR_A_LABEL : DEFAULT_PAIR_B_LABEL;
}

export function suggestTeamSide(
  players: { teamSide: string | null }[]
): "a" | "b" {
  const teamACount = players.filter((player) => player.teamSide === "a").length;
  const teamBCount = players.filter((player) => player.teamSide === "b").length;

  if (teamACount < 2 && (teamACount <= teamBCount || teamBCount >= 2)) {
    return "a";
  }

  return "b";
}

/**
 * Reassigns players inside a pairing group when the event's team size changes.
 * - Teams of 2: fill Team 1 then Team 2 (2 each), preserving existing sides when possible.
 * - Teams of 3/4: one team per group — clear sides; players beyond capacity leave the group.
 */
export function reorganizeGroupForTeamSize<
  T extends { id: string; teamSide: string | null },
>(players: T[], teamSize: TeamSizeOption): { kept: T[]; overflow: T[] } {
  if (teamSize === 2) {
    const existingA = players.filter((player) => player.teamSide === "a");
    const existingB = players.filter((player) => player.teamSide === "b");
    const rest = players.filter(
      (player) => player.teamSide !== "a" && player.teamSide !== "b"
    );

    const teamA = existingA.slice(0, 2);
    const teamB = existingB.slice(0, 2);
    const pool = [...existingA.slice(2), ...existingB.slice(2), ...rest];

    for (const player of pool) {
      if (teamA.length < 2) teamA.push(player);
      else if (teamB.length < 2) teamB.push(player);
    }

    const keptIds = new Set(
      [...teamA, ...teamB].map((player) => player.id)
    );
    const overflow = players
      .filter((player) => !keptIds.has(player.id))
      .map((player) => ({ ...player, teamSide: null }));

    const kept = [
      ...teamA.map((player) => ({ ...player, teamSide: "a" })),
      ...teamB.map((player) => ({ ...player, teamSide: "b" })),
    ];

    return { kept, overflow };
  }

  // One team per group — clear a/b sides and trim to capacity.
  const kept = players.slice(0, teamSize).map((player) => ({
    ...player,
    teamSide: null,
  }));
  const overflow = players.slice(teamSize).map((player) => ({
    ...player,
    teamSide: null,
  }));

  return { kept, overflow };
}

/**
 * Applies {@link reorganizeGroupForTeamSize} across every pairing group.
 * Overflow players return to the unassigned pool with sides cleared.
 */
export function reorganizePairingsForTeamSize<
  TPlayer extends { id: string; teamSide: string | null },
  TGroup extends { players: TPlayer[] },
>(
  groups: TGroup[],
  unassigned: TPlayer[],
  teamSize: TeamSizeOption
): { groups: TGroup[]; unassigned: TPlayer[] } {
  const nextUnassigned: TPlayer[] = unassigned.map((player) => ({
    ...player,
    teamSide: null,
  }));

  const nextGroups = groups.map((group) => {
    const { kept, overflow } = reorganizeGroupForTeamSize(
      group.players,
      teamSize
    );
    nextUnassigned.push(
      ...overflow.map((player) => ({ ...player, teamSide: null }))
    );
    return { ...group, players: kept };
  });

  const seen = new Set<string>();
  const dedupedUnassigned: TPlayer[] = [];
  for (const player of nextUnassigned) {
    if (seen.has(player.id)) continue;
    seen.add(player.id);
    dedupedUnassigned.push(player);
  }

  return { groups: nextGroups, unassigned: dedupedUnassigned };
}

/**
 * Splits a pairing group's players into the team units that compete
 * separately. With teams of 2, a group can hold two teams (sides a/b);
 * otherwise — including legacy groups without side assignments — the whole
 * group is a single team.
 */
export function deriveTeamUnits<T extends { teamSide: string | null }>(
  format: string,
  teamSize: number | null | undefined,
  players: T[]
): { side: "a" | "b" | "team"; players: T[] }[] {
  if (usesPairSides(format, teamSize)) {
    const units = (["a", "b"] as const)
      .map((side) => ({
        side: side as "a" | "b" | "team",
        players: players.filter((player) => player.teamSide === side),
      }))
      .filter((unit) => unit.players.length > 0);
    if (units.length > 0) return units;
  }
  return [{ side: "team", players }];
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
    teamSize?: number | null;
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

  const teamSize = getEffectiveTeamSize(format, options?.teamSize);

  if (teamSize != null) {
    const maxPlayers = getMaxGroupPlayers(format, teamSize);

    if (playerCount < 2) {
      return `${meta.label} groups need at least 2 players (${playerCount} assigned).`;
    }

    if (playerCount > maxPlayers) {
      return `Teams of ${teamSize}: groups can have at most ${maxPlayers} players (${playerCount} assigned).`;
    }

    if (teamSize === 2) {
      const teamACount = options?.teamACount ?? 0;
      const teamBCount = options?.teamBCount ?? 0;
      const sidedCount = teamACount + teamBCount;

      if (teamACount > 2 || teamBCount > 2) {
        return "Each team can have at most 2 players.";
      }

      // Groups of 2 form a single team, so sides are optional there — but a
      // partial or split assignment would create two 1-player teams.
      if (
        playerCount === 2 &&
        sidedCount > 0 &&
        teamACount !== 2 &&
        teamBCount !== 2
      ) {
        return `Assign both players to the same team (${DEFAULT_PAIR_A_LABEL} or ${DEFAULT_PAIR_B_LABEL}).`;
      }

      if (playerCount > 2 && sidedCount < playerCount) {
        return `Assign each player to ${DEFAULT_PAIR_A_LABEL} or ${DEFAULT_PAIR_B_LABEL}.`;
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
