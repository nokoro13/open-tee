"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, X } from "lucide-react";

import { EventScorecardPreview } from "@/components/dashboard/event-scorecard-preview";
import {
  buildCourseSelection,
  emptyCourseSelection,
  type CourseSelection,
} from "@/lib/course-selection";
import {
  formatTeeOptionLabel,
  pickDefaultTeeKey,
  type CourseDetail,
  type CourseSummary,
} from "@/lib/course-catalog";
import { parseCourseCountry } from "@/lib/course-location";
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

export type { CourseSelection } from "@/lib/course-selection";

type CoursePickerProps = {
  selection: CourseSelection;
  holes: "9" | "18";
  onChange: (selection: CourseSelection) => void;
};

function formatCourseLocation(course: CourseSummary): string {
  const parts = [course.city, course.state].filter(Boolean);
  const locality = parts.length > 0 ? parts.join(", ") : "Location unknown";
  return parseCourseCountry(course.country) === "CA"
    ? `${locality === "Location unknown" ? "Canada" : `${locality}, Canada`}`
    : locality;
}

async function loadCourseDetail(courseId: string, teeKey?: string | null) {
  const params = new URLSearchParams();
  if (teeKey) params.set("teeKey", teeKey);
  const queryString = params.toString();
  const response = await fetch(
    `/api/courses/${courseId}${queryString ? `?${queryString}` : ""}`
  );
  if (!response.ok) throw new Error("Failed to load course");
  const data = (await response.json()) as { course: CourseDetail };
  return data.course;
}

export function CoursePicker({ selection, holes, onChange }: CoursePickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    (CourseSummary & { source?: string })[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(
    null
  );
  const [selectedTeeKey, setSelectedTeeKey] = useState<string | null>(
    selection.selectedTeeKey ?? null
  );
  const [side, setSide] = useState<"front" | "back">(
    selection.nineSide ?? "front"
  );
  const [isLoadingCourse, setIsLoadingCourse] = useState(false);

  const hasSelectedCourse = Boolean(selection.externalCourseId);
  const teeOptions = selectedCourse?.tees ?? [];

  const previewSelection = useMemo(() => {
    if (selectedCourse && selectedTeeKey) {
      return buildCourseSelection(selectedCourse, selectedTeeKey, {
        holes,
        nineSide: side,
      });
    }

    return selection;
  }, [selectedCourse, selectedTeeKey, holes, side, selection]);

  const selectedTee = useMemo(
    () =>
      teeOptions.find((tee) => tee.tee_key === selectedTeeKey) ??
      teeOptions.find((tee) => tee.tee_key === previewSelection.selectedTeeKey) ??
      null,
    [teeOptions, previewSelection.selectedTeeKey, selectedTeeKey]
  );

  useEffect(() => {
    if (!selection.externalCourseId) {
      setSelectedCourse(null);
      setSelectedTeeKey(null);
      return;
    }

    if (selectedCourse?.id === selection.externalCourseId) {
      if (
        selection.selectedTeeKey &&
        selectedTeeKey !== selection.selectedTeeKey
      ) {
        setSelectedTeeKey(selection.selectedTeeKey);
      }
      return;
    }

    let cancelled = false;

    async function restoreCourse() {
      setIsLoadingCourse(true);
      setSearchError(null);
      try {
        const detail = await loadCourseDetail(
          selection.externalCourseId!,
          selection.selectedTeeKey
        );
        if (cancelled) return;
        setSelectedCourse(detail);
        const teeKey =
          selection.selectedTeeKey ??
          pickDefaultTeeKey(detail.tees) ??
          null;
        setSelectedTeeKey(teeKey);
        applySelection(detail, teeKey, holes, side);
      } catch {
        if (!cancelled) {
          setSearchError("Could not load course details. Try searching again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCourse(false);
        }
      }
    }

    void restoreCourse();

    return () => {
      cancelled = true;
    };
  }, [selection.externalCourseId, selection.selectedTeeKey, selectedCourse?.id]);

  useEffect(() => {
    if (query.trim().length < 2) {
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
        const data = (await response.json()) as {
          courses: (CourseSummary & { source?: string })[];
        };
        setResults(data.courses);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchError("Course search unavailable. Please try again.");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function applySelection(
    course: CourseDetail,
    teeKey: string | null,
    nextHoles: "9" | "18",
    nextSide: "front" | "back"
  ) {
    onChange(
      buildCourseSelection(course, teeKey, {
        holes: nextHoles,
        nineSide: nextSide,
      })
    );
  }

  async function handleSelectCourse(course: CourseSummary) {
    setQuery("");
    setResults([]);
    setSearchError(null);

    try {
      const detail = await loadCourseDetail(course.id);
      const teeKey = pickDefaultTeeKey(detail.tees);
      setSelectedCourse(detail);
      setSelectedTeeKey(teeKey);
      applySelection(detail, teeKey, holes, side);
    } catch {
      setSearchError("Could not load course scorecard.");
    }
  }

  async function handleTeeChange(teeKey: string) {
    if (!selectedCourse) return;
    setSelectedTeeKey(teeKey);
    applySelection(selectedCourse, teeKey, holes, side);
  }

  function handleClearCourse() {
    setSelectedCourse(null);
    setSelectedTeeKey(null);
    setQuery("");
    setResults([]);
    setSearchError(null);
    onChange(emptyCourseSelection());
  }

  useEffect(() => {
    if (selectedCourse && selectedTeeKey) {
      applySelection(selectedCourse, selectedTeeKey, holes, side);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild scorecard when course/tee/holes/side change
  }, [holes, side, selectedCourse, selectedTeeKey]);

  const showNineSidePicker =
    hasSelectedCourse &&
    holes === "9" &&
    (selectedCourse?.scorecard?.length ?? previewSelection.scorecardHoles.length) >=
      9;

  const selectedCourseName =
    selectedCourse?.name ?? selection.courseName.trim() ?? "";
  const selectedCourseAddress =
    selectedCourse?.address ?? selection.courseAddress ?? null;

  return (
    <div className="space-y-4">
      {!hasSelectedCourse ? (
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
            Search verified OpenRound courses with official scorecards and hole
            mapping.
          </FieldDescription>

          {isSearching && (
            <p className="text-sm text-muted-foreground">Searching...</p>
          )}
          {searchError && (
            <p className="text-sm text-destructive">{searchError}</p>
          )}

          {results.length > 0 && (
            <ul className="max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background sm:max-h-48">
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
                        {course.source === "verified" ? " · Verified" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>
      ) : (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{selectedCourseName}</p>
              {selectedCourseAddress && (
                <p className="text-muted-foreground">{selectedCourseAddress}</p>
              )}
              {(selectedCourse?.phone || selectedCourse?.website) && (
                <p className="text-xs text-muted-foreground">
                  {[selectedCourse.phone, selectedCourse.website]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={handleClearCourse}
            >
              Change
            </Button>
          </div>

          {isLoadingCourse && (
            <p className="text-sm text-muted-foreground">Loading tees...</p>
          )}

          {!isLoadingCourse && teeOptions.length > 0 && (
            <Field>
              <FieldLabel>Tournament tees</FieldLabel>
              <Select
                value={selectedTeeKey ?? undefined}
                onValueChange={(value) => {
                  if (value) void handleTeeChange(value);
                }}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Select tees">
                    {teeOptions.find((tee) => tee.tee_key === selectedTeeKey)
                      ? formatTeeOptionLabel(
                          teeOptions.find(
                            (tee) => tee.tee_key === selectedTeeKey
                          )!
                        )
                      : selection.teeName ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teeOptions.map((tee) => (
                    <SelectItem key={tee.tee_key} value={tee.tee_key}>
                      {formatTeeOptionLabel(tee)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Yardages and rating on scorecards use the selected tee.
              </FieldDescription>
            </Field>
          )}

          {!isLoadingCourse && teeOptions.length === 0 && selection.teeName && (
            <p className="text-sm text-muted-foreground">
              Selected tee: {selection.teeName}
            </p>
          )}
        </div>
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

      {previewSelection.scorecardHoles.length > 0 && (
        <EventScorecardPreview
          holes={previewSelection.scorecardHoles}
          teeName={previewSelection.teeName}
          teeColor={selectedTee?.tee_color}
          courseRating={previewSelection.courseRating}
          courseSlope={previewSelection.courseSlope}
          totalYardage={previewSelection.courseTotalYardage}
        />
      )}
    </div>
  );
}
