import type { OsmPrefillCoverage } from "@/lib/course-onboarding-osm-prefill";
import type { ScorecardOcrResult } from "@/lib/scorecard-ocr";

export type OnboardingActionResult =
  | { success: true; courseId?: string }
  | { success: false; error: string };

export type OsmPrefillActionResult =
  | {
      success: true;
      courseId?: string;
      coverage: OsmPrefillCoverage;
      appliedHoleCount: number;
    }
  | { success: false; error: string };

export type ScorecardOcrActionResult =
  | { success: true; data: ScorecardOcrResult }
  | { success: false; error: string };
