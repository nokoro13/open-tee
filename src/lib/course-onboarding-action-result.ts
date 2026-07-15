export type OnboardingActionResult =
  | { success: true; courseId?: string }
  | { success: false; error: string };
