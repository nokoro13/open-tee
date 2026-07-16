"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { checkCourseOnboardingDuplicate } from "@/actions/course-onboarding";
import {
  duplicateCourseError,
  type CourseDuplicateMatch,
} from "@/lib/course-onboarding";
import {
  formatCourseLocationLine,
  type CourseCountry,
} from "@/lib/course-location";

type CourseDuplicateInput = {
  name: string;
  city: string;
  state: string;
  country: CourseCountry;
  excludeCourseId?: string;
};

export function useCourseDuplicateCheck(input: CourseDuplicateInput) {
  const [matches, setMatches] = useState<CourseDuplicateMatch[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const trimmedName = input.name.trim();
    if (trimmedName.length < 2) {
      setMatches([]);
      return;
    }

    let cancelled = false;
    setIsChecking(true);

    const timeout = window.setTimeout(() => {
      void checkCourseOnboardingDuplicate({
        name: trimmedName,
        city: input.city,
        state: input.state,
        country: input.country,
        excludeCourseId: input.excludeCourseId,
      })
        .then((result) => {
          if (!cancelled) {
            setMatches(result.matches);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsChecking(false);
          }
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    input.name,
    input.city,
    input.state,
    input.country,
    input.excludeCourseId,
  ]);

  const hasExactMatch = matches.some((match) => match.matchType === "exact");

  return { matches, isChecking, hasExactMatch };
}

function duplicateStatusLabel(match: CourseDuplicateMatch): string {
  if (match.onboardingStatus === "verified") return "verified";
  return match.onboardingStatus.replace("_", " ");
}

type CourseDuplicateWarningProps = {
  matches: CourseDuplicateMatch[];
  isChecking: boolean;
};

export function CourseDuplicateWarning({
  matches,
  isChecking,
}: CourseDuplicateWarningProps) {
  if (matches.length === 0) {
    return null;
  }

  const exactMatch = matches.find((match) => match.matchType === "exact");
  const isBlocking = Boolean(exactMatch);

  return (
    <div
      className={
        isBlocking
          ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          : "rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
      }
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-2">
          <p>{duplicateCourseError(matches)}</p>
          <ul className="space-y-1 text-xs">
            {matches.slice(0, 3).map((match) => (
              <li key={match.id}>
                {match.name}
                {" · "}
                {formatCourseLocationLine({
                  city: match.city,
                  state: match.state,
                  country: match.country,
                })}
                {" · "}
                {duplicateStatusLabel(match)}
              </li>
            ))}
          </ul>
          {isChecking && (
            <p className="text-xs text-muted-foreground">Checking for duplicates...</p>
          )}
        </div>
      </div>
    </div>
  );
}
