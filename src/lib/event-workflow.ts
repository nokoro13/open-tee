import type { Event } from "@/db/schema";
import {
  getGroupSizeWarning,
  requiresTeamSides,
} from "@/lib/event-formats";
import type { EventPairings } from "@/lib/pairings";

export type EventWorkflowPhase =
  | "registration"
  | "pairings"
  | "scorecards"
  | "scoring"
  | "complete";

export type WorkflowStepId =
  | "registration"
  | "pairings"
  | "scorecards"
  | "scoring";

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  description: string;
  tab: "players" | "pairings" | "scoring";
  href?: string;
  finalizedAt: Date | null;
  isComplete: boolean;
  isCurrent: boolean;
  isLocked: boolean;
};

export type EventWorkflowSnapshot = {
  phase: EventWorkflowPhase;
  steps: WorkflowStep[];
  currentStep: WorkflowStep;
  registrationOpen: boolean;
  canFinalizeRegistration: boolean;
  canFinalizePairings: boolean;
  canMarkScorecardsReady: boolean;
  canOpenScoring: boolean;
  pairingsIssues: string[];
  autoFinalizeReasons: string[];
};

export function isRegistrationFinalized(
  event: Pick<Event, "registrationFinalizedAt">
): boolean {
  return event.registrationFinalizedAt != null;
}

export function isPublicRegistrationOpen(
  event: Pick<Event, "status" | "registrationFinalizedAt" | "scoringStatus">
): boolean {
  return (
    event.status === "published" &&
    !event.registrationFinalizedAt &&
    event.scoringStatus === "disabled"
  );
}

export function isPairingsFinalized(
  event: Pick<Event, "pairingsFinalizedAt">
): boolean {
  return event.pairingsFinalizedAt != null;
}

export function areScorecardsReady(
  event: Pick<Event, "scorecardsReadyAt">
): boolean {
  return event.scorecardsReadyAt != null;
}

export function getEventWorkflowPhase(
  event: Pick<
    Event,
    | "scoringStatus"
    | "registrationFinalizedAt"
    | "pairingsFinalizedAt"
    | "scorecardsReadyAt"
  >,
  options?: { hasPairingGroups?: boolean }
): EventWorkflowPhase {
  if (event.scoringStatus === "finalized") return "complete";
  if (event.scoringStatus === "open") return "scoring";
  if (event.scorecardsReadyAt || event.pairingsFinalizedAt) return "scorecards";
  if (options?.hasPairingGroups) return "pairings";
  return "registration";
}

export function isRegistrationWindowExpired(
  event: Pick<Event, "registrationCloses">
): boolean {
  if (!event.registrationCloses) return false;
  return new Date() > event.registrationCloses;
}

export function validatePairingsForFormat(
  format: string,
  pairings: EventPairings
): string[] {
  const issues: string[] = [];

  if (pairings.groups.length === 0) {
    issues.push("Create at least one pairing group.");
  }

  if (pairings.unassigned.length > 0) {
    issues.push(
      `${pairings.unassigned.length} player${pairings.unassigned.length === 1 ? "" : "s"} still unassigned.`
    );
  }

  for (const group of pairings.groups) {
    const playerCount = group.players.length;
    if (playerCount === 0) {
      issues.push(`${group.label} has no players assigned.`);
      continue;
    }

    const teamACount = group.players.filter((p) => p.teamSide === "a").length;
    const teamBCount = group.players.filter((p) => p.teamSide === "b").length;

    const warning = getGroupSizeWarning(format, playerCount, {
      matchType: group.matchType,
      teamACount,
      teamBCount,
    });

    if (warning) {
      issues.push(`${group.label}: ${warning}`);
    }

    if (requiresTeamSides(format) && format !== "ryder_cup") {
      const unassignedSide = group.players.filter((p) => !p.teamSide);
      if (unassignedSide.length > 0) {
        issues.push(`${group.label}: assign a team side for every player.`);
      }
    }
  }

  return issues;
}

export function getRegistrationFinalizeReasons(options: {
  registrationCount: number;
  maxPlayers: number;
  registrationCloses: Date | null;
}): string[] {
  const reasons: string[] = [];
  const { registrationCount, maxPlayers, registrationCloses } = options;

  if (maxPlayers > 0 && registrationCount >= maxPlayers) {
    reasons.push("Field is at capacity.");
  }

  if (registrationCloses && new Date() > registrationCloses) {
    reasons.push("Registration deadline has passed.");
  }

  return reasons;
}

export function buildEventWorkflowSnapshot(options: {
  event: Pick<
    Event,
    | "status"
    | "scoringStatus"
    | "registrationOpens"
    | "registrationCloses"
    | "registrationFinalizedAt"
    | "pairingsFinalizedAt"
    | "scorecardsReadyAt"
    | "scoringFinalizedAt"
    | "maxPlayers"
  >;
  eventId: string;
  format: string;
  registrationCount: number;
  pairings: EventPairings | null;
}): EventWorkflowSnapshot {
  const { event, eventId, format, registrationCount, pairings } = options;
  const hasPairingGroups = (pairings?.groups.length ?? 0) > 0;
  const phase = getEventWorkflowPhase(event, { hasPairingGroups });
  const registrationOpen = isPublicRegistrationOpen(event);
  const registrationClosed = !registrationOpen;
  const pairingsReady =
    pairings != null &&
    registrationCount > 0 &&
    validatePairingsForFormat(format, pairings).length === 0;
  const scoringDone = event.scoringStatus === "finalized";
  const scoringLive = event.scoringStatus === "open";

  const pairingsIssues =
    pairings != null ? validatePairingsForFormat(format, pairings) : [];

  const autoFinalizeReasons = getRegistrationFinalizeReasons({
    registrationCount,
    maxPlayers: event.maxPlayers,
    registrationCloses: event.registrationCloses,
  });

  const steps: WorkflowStep[] = [
    {
      id: "registration",
      label: "Registration",
      description: registrationOpen
        ? "Online signup is open. Close it anytime in Settings."
        : "Online signup is closed.",
      tab: "players",
      finalizedAt: event.registrationFinalizedAt,
      isComplete: registrationClosed,
      isCurrent: phase === "registration",
      isLocked: false,
    },
    {
      id: "pairings",
      label: "Pairings",
      description: pairingsReady
        ? "Every registered player is assigned to a group."
        : "Assign players to groups while registration stays open.",
      tab: "pairings",
      finalizedAt: event.pairingsFinalizedAt,
      isComplete: pairingsReady || scoringLive || scoringDone,
      isCurrent: phase === "pairings",
      isLocked: false,
    },
    {
      id: "scorecards",
      label: "Scorecards",
      description: hasPairingGroups
        ? "Print one scorecard per group with QR codes."
        : "Create groups first, then print scorecards.",
      tab: "pairings",
      href: hasPairingGroups ? `/print/events/${eventId}/scorecards` : undefined,
      finalizedAt: null,
      isComplete: false,
      isCurrent: phase === "scorecards",
      isLocked: false,
    },
    {
      id: "scoring",
      label: "Scoring",
      description: scoringDone
        ? "Final results published."
        : scoringLive
          ? "Players are entering scores."
          : "Open scoring on tournament day.",
      tab: "scoring",
      finalizedAt: event.scoringFinalizedAt ?? null,
      isComplete: scoringDone,
      isCurrent: phase === "scoring" || phase === "complete",
      isLocked: !pairingsReady && !scoringLive && !scoringDone,
    },
  ];

  const currentStep =
    steps.find((step) => step.isCurrent) ??
    steps.find((step) => !step.isComplete) ??
    steps[steps.length - 1];

  return {
    phase,
    steps,
    currentStep,
    registrationOpen,
    canFinalizeRegistration: false,
    canFinalizePairings: false,
    canMarkScorecardsReady: false,
    canOpenScoring:
      event.scoringStatus === "disabled" &&
      registrationCount > 0 &&
      pairingsIssues.length === 0,
    pairingsIssues,
    autoFinalizeReasons,
  };
}

export const WORKFLOW_PHASE_LABELS: Record<EventWorkflowPhase, string> = {
  registration: "Registration open",
  pairings: "Building pairings",
  scorecards: "Print scorecards",
  scoring: "Scoring live",
  complete: "Event complete",
};
