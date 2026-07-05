"use client";

import { useEffect, useState } from "react";
import { MapPin, Search, X } from "lucide-react";

import type { ScorecardHoleSnapshot } from "@/lib/scorecard";
import { totalPar } from "@/lib/scorecard";
import type { OpenGolfCourseDetail, OpenGolfCourseSummary } from "@/lib/opengolfapi";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CourseSelection = {
  courseName: string;
  externalCourseId: string | null;
  nineSide: "front" | "back" | null;
  scorecardHoles: ScorecardHoleSnapshot[];
};

type CoursePickerProps = {
  courseName: string;
  externalCourseId: string | null;
  nineSide: "front" | "back" | null;
  initialScorecard?: ScorecardHoleSnapshot[];
  holes: "9" | "18";
  onChange: (selection: CourseSelection) => void;
};

function formatCourseLocation(course: OpenGolfCourseSummary): string {
  const parts = [course.city, course.state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Location unknown";
}

export function CoursePicker({
  courseName,
  externalCourseId,
  nineSide,
  initialScorecard = [],
  holes,
  onChange,
}: CoursePickerProps) {
  const [mode, setMode] = useState<"search" | "manual">(
    externalCourseId ? "search" : "manual"
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpenGolfCourseSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<OpenGolfCourseDetail | null>(
    null
  );
  const [scorecard, setScorecard] = useState<ScorecardHoleSnapshot[]>(
    initialScorecard
  );
  const [side, setSide] = useState<"front" | "back">(nineSide ?? "front");
  const [manualName, setManualName] = useState(courseName);
  const [loadedCourseId, setLoadedCourseId] = useState<string | null>(
    externalCourseId
  );

  useEffect(() => {
    if (!externalCourseId || loadedCourseId === externalCourseId) return;

    async function loadCourse() {
      try {
        const response = await fetch(`/api/courses/${externalCourseId}`);
        if (!response.ok) return;
        const data = (await response.json()) as { course: OpenGolfCourseDetail };
        setSelectedCourse(data.course);
        setLoadedCourseId(externalCourseId);
        setMode("search");
      } catch {
        // Keep manual fallback
      }
    }

    void loadCourse();
  }, [externalCourseId, loadedCourseId]);

  useEffect(() => {
    if (mode !== "search" || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const response = await fetch(
          `/api/courses/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as { courses: OpenGolfCourseSummary[] };
        setResults(data.courses);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchError("Course search unavailable. Try manual entry.");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, mode]);

  function applyScorecard(
    course: OpenGolfCourseDetail,
    nextHoles: "9" | "18",
    nextSide: "front" | "back"
  ) {
    if (!course.scorecard?.length) {
      setScorecard([]);
      onChange({
        courseName: course.name,
        externalCourseId: course.id,
        nineSide: nextHoles === "9" ? nextSide : null,
        scorecardHoles: [],
      });
      return;
    }

    const sorted = [...course.scorecard].sort((a, b) => a.hole - b.hole);
    const slice =
      nextHoles === "9"
        ? nextSide === "back" && sorted.length >= 18
          ? sorted.slice(9, 18)
          : sorted.slice(0, 9)
        : sorted.slice(0, 18);

    const snapshot = slice.map((hole, index) => ({
      holeNumber: index + 1,
      par: hole.par,
      yardage: hole.yardage ?? null,
      strokeIndex: hole.handicap_index ?? null,
    }));

    setScorecard(snapshot);
    onChange({
      courseName: course.name,
      externalCourseId: course.id,
      nineSide: nextHoles === "9" ? nextSide : null,
      scorecardHoles: snapshot,
    });
  }

  async function handleSelectCourse(course: OpenGolfCourseSummary) {
    setQuery("");
    setResults([]);
    setSearchError(null);

    try {
      const response = await fetch(`/api/courses/${course.id}`);
      if (!response.ok) throw new Error("Failed to load course");
      const data = (await response.json()) as { course: OpenGolfCourseDetail };
      setSelectedCourse(data.course);
      setLoadedCourseId(course.id);
      applyScorecard(data.course, holes, side);
    } catch {
      setSearchError("Could not load course scorecard.");
    }
  }

  function handleManualChange(name: string) {
    setManualName(name);
    setSelectedCourse(null);
    setScorecard([]);
    onChange({
      courseName: name,
      externalCourseId: null,
      nineSide: null,
      scorecardHoles: [],
    });
  }

  function switchToManual() {
    setMode("manual");
    setSelectedCourse(null);
    setScorecard([]);
    setQuery("");
    setResults([]);
    handleManualChange(manualName || courseName);
  }

  function switchToSearch() {
    setMode("search");
    setManualName(courseName);
  }

  useEffect(() => {
    if (selectedCourse) {
      applyScorecard(selectedCourse, holes, side);
    }
  }, [holes, side, selectedCourse?.id]);

  const showNineSidePicker =
    mode === "search" &&
    selectedCourse != null &&
    holes === "9" &&
    (selectedCourse.scorecard?.length ?? 0) >= 9;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant={mode === "search" ? "default" : "outline"}
          size="sm"
          className="h-11 w-full sm:h-7 sm:w-auto"
          onClick={switchToSearch}
        >
          <Search />
          Search courses
        </Button>
        <Button
          type="button"
          variant={mode === "manual" ? "default" : "outline"}
          size="sm"
          className="h-11 w-full sm:h-7 sm:w-auto"
          onClick={switchToManual}
        >
          Enter manually
        </Button>
      </div>

      {mode === "search" ? (
        <Field>
          <FieldLabel htmlFor="courseSearch">Find a golf course</FieldLabel>
          <div className="relative">
            <Input
              id="courseSearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by course name or city..."
              className="h-11 pr-10 text-base sm:text-sm"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <FieldDescription>
            Powered by OpenGolfAPI. US courses have the best coverage; use manual
            entry for courses not listed.
          </FieldDescription>

          {isSearching && (
            <p className="text-sm text-muted-foreground">Searching...</p>
          )}
          {searchError && (
            <p className="text-sm text-destructive">{searchError}</p>
          )}

          {results.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background">
              {results.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-start gap-2 px-3 py-3 text-left text-sm hover:bg-muted active:bg-muted"
                    onClick={() => void handleSelectCourse(course)}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      <span className="block font-medium">{course.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCourseLocation(course)}
                        {course.par ? ` · Par ${course.par}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedCourse && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <p className="font-medium">{selectedCourse.name}</p>
              {selectedCourse.address && (
                <p className="text-muted-foreground">{selectedCourse.address}</p>
              )}
            </div>
          )}
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor="courseName">Course name</FieldLabel>
          <Input
            id="courseName"
            value={manualName}
            onChange={(e) => handleManualChange(e.target.value)}
            placeholder="Riverside Golf Club"
            className="h-11 text-base sm:text-sm"
            required
          />
          <FieldDescription>
            Manual entry — scoring will show strokes only (no par comparison).
          </FieldDescription>
        </Field>
      )}

      {showNineSidePicker && (
        <Field>
          <FieldLabel>Which nine?</FieldLabel>
          <Select
            value={side}
            onValueChange={(value) => {
              if (value === "front" || value === "back") setSide(value);
            }}
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="front">Front nine (holes 1–9)</SelectItem>
              <SelectItem value="back">Back nine (holes 10–18)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      {scorecard.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="mb-2 text-sm font-medium">
            Scorecard preview · Par {totalPar(scorecard)}
          </p>
          <div className="grid grid-cols-6 gap-1 text-center text-xs sm:grid-cols-9">
            {scorecard.map((hole) => (
              <div
                key={hole.holeNumber}
                className="rounded-md bg-background px-1 py-1.5 ring-1 ring-border"
              >
                <div className="font-medium">{hole.holeNumber}</div>
                <div className="text-muted-foreground">Par {hole.par}</div>
                {hole.yardage != null && (
                  <div className="text-[10px] text-muted-foreground">
                    {hole.yardage} yds
                  </div>
                )}
                {hole.strokeIndex != null && (
                  <div className="text-[10px] text-muted-foreground">
                    HCP {hole.strokeIndex}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
