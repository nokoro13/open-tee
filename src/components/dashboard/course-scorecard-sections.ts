import { holeNumbersForCount } from "@/lib/course-onboarding";

export type ScorecardNineSection = {
  label: string | null;
  holeNumbers: number[];
};

export function buildScorecardNineSections(holeCount: number): ScorecardNineSection[] {
  const holeNumbers = holeNumbersForCount(holeCount);
  const frontNine = holeNumbers.filter((hole) => hole <= 9);
  const backNine = holeNumbers.filter((hole) => hole > 9);

  if (backNine.length > 0) {
    return [
      { label: "Front", holeNumbers: frontNine },
      { label: "Back", holeNumbers: backNine },
    ];
  }

  return [{ label: null, holeNumbers }];
}
