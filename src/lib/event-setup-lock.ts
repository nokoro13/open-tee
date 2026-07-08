export type EventScoringStatus = "disabled" | "open" | "finalized";

export function isEventSetupLocked(scoringStatus: EventScoringStatus): boolean {
  return scoringStatus === "open" || scoringStatus === "finalized";
}

export function eventSetupLockedMessage(
  scoringStatus: EventScoringStatus
): string {
  if (scoringStatus === "finalized") {
    return "Registration, schedule, and pairings are locked after results are finalized.";
  }
  return "Registration, schedule, and pairings are locked while scoring is live.";
}

export function assertEventSetupUnlocked(
  scoringStatus: EventScoringStatus
): { ok: true } | { ok: false; error: string } {
  if (isEventSetupLocked(scoringStatus)) {
    return { ok: false, error: eventSetupLockedMessage(scoringStatus) };
  }
  return { ok: true };
}
