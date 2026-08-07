"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, MapPin, Maximize2, ScanLine, Sparkles, Upload } from "lucide-react";

import {
  extractCourseOnboardingScorecard,
  prefillCourseOnboardingFromOsm,
  saveCourseOnboardingHolePin,
  saveCourseOnboardingScorecard,
  submitCourseForVerification,
  updateCourseOnboardingDetails,
} from "@/actions/course-onboarding";
import { CourseGooglePlaceSearch } from "@/components/dashboard/course-google-place-search";
import { CourseHolePinMap } from "@/components/dashboard/course-hole-pin-map";
import { CourseScorecardEditTable } from "@/components/dashboard/course-scorecard-edit-table";
import { HoleStrip } from "@/components/dashboard/hole-strip";
import { ScorecardOcrTotalsPanel } from "@/components/dashboard/scorecard-ocr-totals-panel";
import { compressScorecardImage } from "@/lib/compress-scorecard-image";
import {
  CourseDuplicateWarning,
  useCourseDuplicateCheck,
} from "@/components/dashboard/course-duplicate-warning";
import { CourseRegionSelect, clearRegionIfInvalid } from "@/components/dashboard/course-region-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  countCourseMappingProgress,
  extractHolePinsFromFeatures,
  holeNumbersForCount,
  type CourseOnboardingStep,
} from "@/lib/course-onboarding";
import {
  DEFAULT_COURSE_TEES,
  normalizeTeeKey,
  PRESET_COURSE_TEES,
  sortCourseTees,
  type CourseTeeInput,
} from "@/lib/course-tees";
import {
  buildHandicapRowsFromHoles,
  DEFAULT_SCORECARD_HANDICAP_ROWS,
  PRESET_SCORECARD_HANDICAP_ROWS,
  sortScorecardHandicapRows,
  type ScorecardHandicapRowInput,
  type ScorecardHandicapRowKey,
} from "@/lib/scorecard-handicap-rows";
import type {
  ScorecardParValidation,
  ScorecardStrokeIndexValidation,
  ScorecardYardageValidation,
} from "@/lib/scorecard-ocr";
import type {
  CourseHole,
  CourseTee,
  GolfCourse,
  GreenTarget,
  HoleFeature,
} from "@/db/schema";
import { parseCoordinate, holeNumbersForMapping } from "@/lib/green-distance";
import {
  COURSE_COUNTRIES,
  formatCourseLocationLine,
  parseCourseCountry,
  resolveCourseLocation,
  type CourseCountry,
} from "@/lib/course-location";
import { cn } from "@/lib/utils";

type ScorecardRow = {
  holeNumber: number;
  par: number;
  strokeIndex: string;
  ladiesStrokeIndex: string;
  teeYardages: Record<string, string>;
};

type CourseOnboardingWizardProps = {
  course: GolfCourse & {
    courseTees: CourseTee[];
    courseHoles: CourseHole[];
    holeFeatures: HoleFeature[];
    greenTargets: GreenTarget[];
  };
  initialStep: CourseOnboardingStep;
  canEditVerifiedCourse?: boolean;
};

const STEPS: {
  id: CourseOnboardingStep;
  label: string;
  shortLabel?: string;
}[] = [
  { id: "details", label: "Course details", shortLabel: "Details" },
  { id: "scorecard", label: "Scorecard" },
  { id: "mapping", label: "Hole mapping", shortLabel: "Mapping" },
  { id: "review", label: "Review" },
];

function CourseOnboardingStepTabs({
  activeStep,
  onStepChange,
}: {
  activeStep: CourseOnboardingStep;
  onStepChange: (step: CourseOnboardingStep) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<CourseOnboardingStep, HTMLButtonElement>());

  useEffect(() => {
    const activeButton = tabRefs.current.get(activeStep);
    if (!activeButton || !scrollRef.current) return;

    const container = scrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const offset =
      buttonRect.left -
      containerRect.left -
      (containerRect.width - buttonRect.width) / 2;

    container.scrollTo({
      left: container.scrollLeft + offset,
      behavior: "smooth",
    });
  }, [activeStep]);

  return (
    <nav aria-label="Onboarding steps" className="relative min-w-0 flex-1">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-linear-to-r from-background to-transparent sm:w-8 md:hidden"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-linear-to-l from-background to-transparent sm:w-8 md:hidden"
      />

      <div
        ref={scrollRef}
        className={cn(
          "flex min-w-0 border-b border-border",
          "overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden",
          "snap-x snap-mandatory touch-pan-x",
          "md:snap-none md:overflow-visible"
        )}
      >
        {STEPS.map((entry) => {
          const isActive = activeStep === entry.id;
          const mobileLabel = entry.shortLabel ?? entry.label;

          return (
            <button
              key={entry.id}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(entry.id, node);
                } else {
                  tabRefs.current.delete(entry.id);
                }
              }}
              type="button"
              aria-current={isActive ? "step" : undefined}
              onClick={() => onStepChange(entry.id)}
              className={cn(
                "relative shrink-0 snap-start border-b-2 px-3.5 py-3 text-sm font-medium transition-colors",
                "min-h-11 touch-manipulation whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "md:flex-1 md:px-2 md:text-center lg:px-4",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <span className="md:hidden">{mobileLabel}</span>
              <span className="hidden md:inline">{entry.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function buildScorecardRows(
  holeCount: number,
  existing: CourseHole[],
  teeKeys: string[]
): ScorecardRow[] {
  return holeNumbersForCount(holeCount).map((holeNumber) => {
    const hole = existing.find((entry) => entry.holeNumber === holeNumber);
    const teeYardages = Object.fromEntries(
      teeKeys.map((teeKey) => [
        teeKey,
        hole?.teeYardages?.[teeKey] != null
          ? String(hole.teeYardages[teeKey])
          : hole?.yardage != null && teeKeys.length === 1
            ? String(hole.yardage)
            : "",
      ])
    );

    return {
      holeNumber,
      par: hole?.par ?? 4,
      strokeIndex:
        hole?.strokeIndex != null ? String(hole.strokeIndex) : String(holeNumber),
      ladiesStrokeIndex:
        hole?.ladiesStrokeIndex != null ? String(hole.ladiesStrokeIndex) : "",
      teeYardages,
    };
  });
}

function buildTeeRows(existing: CourseTee[]): CourseTeeInput[] {
  if (existing.length > 0) {
    return sortCourseTees(existing).map((tee) => ({
      teeKey: tee.teeKey,
      teeName: tee.teeName,
      teeColor: tee.teeColor,
      sortOrder: tee.sortOrder,
    }));
  }
  return DEFAULT_COURSE_TEES.map((tee, index) => ({
    ...tee,
    sortOrder: index,
  }));
}

export function CourseOnboardingWizard({
  course,
  initialStep,
  canEditVerifiedCourse = false,
}: CourseOnboardingWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploadingScorecard, setIsUploadingScorecard] = useState(false);
  const [step, setStep] = useState<CourseOnboardingStep>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeHole, setActiveHole] = useState(1);

  const initialLocation = resolveCourseLocation(course.country, course.state);

  const [name, setName] = useState(course.name);
  const [address, setAddress] = useState(course.address ?? "");
  const [country, setCountry] = useState<CourseCountry>(initialLocation.country);
  const [city, setCity] = useState(course.city ?? "");
  const [state, setState] = useState(initialLocation.region);
  const [latitude, setLatitude] = useState(
    parseCoordinate(course.latitude)?.toString() ?? ""
  );
  const [longitude, setLongitude] = useState(
    parseCoordinate(course.longitude)?.toString() ?? ""
  );
  const [holeCount, setHoleCount] = useState<"9" | "18">(
    course.holeCount === 9 ? "9" : "18"
  );
  const [backNineMirrorsFront, setBackNineMirrorsFront] = useState(
    course.backNineMirrorsFront
  );
  const [externalCourseId, setExternalCourseId] = useState(
    course.externalCourseId ?? null
  );
  const [scorecardImageUrl, setScorecardImageUrl] = useState(
    course.scorecardImageUrl ?? ""
  );
  const [teeRows, setTeeRows] = useState<CourseTeeInput[]>(() =>
    buildTeeRows(course.courseTees)
  );
  const [handicapRows, setHandicapRows] = useState<ScorecardHandicapRowInput[]>(
    () => buildHandicapRowsFromHoles(course.courseHoles)
  );
  const [scorecardRows, setScorecardRows] = useState<ScorecardRow[]>(() =>
    buildScorecardRows(
      course.holeCount,
      course.courseHoles,
      buildTeeRows(course.courseTees).map((tee) => tee.teeKey)
    )
  );
  const scorecardHydratedRevision = useRef<string | null>(null);
  const scorecardFileInputRef = useRef<HTMLInputElement>(null);
  const [ocrParValidation, setOcrParValidation] =
    useState<ScorecardParValidation | null>(null);
  const [ocrYardageValidation, setOcrYardageValidation] = useState<
    ScorecardYardageValidation[]
  >([]);
  const [ocrHandicapValidation, setOcrHandicapValidation] = useState<
    ScorecardStrokeIndexValidation[]
  >([]);
  const [customTeeName, setCustomTeeName] = useState("");
  const [scorecardPreviewOpen, setScorecardPreviewOpen] = useState(false);

  const duplicateCheck = useCourseDuplicateCheck({
    name,
    city,
    state,
    country,
    excludeCourseId: course.id,
  });

  useEffect(() => {
    if (step !== "scorecard") return;

    const revision = `${course.id}:${course.updatedAt?.toISOString() ?? "unknown"}:${course.holeCount}`;
    if (scorecardHydratedRevision.current === revision) return;

    const teeKeys = sortCourseTees(teeRows).map(
      (tee) => tee.teeKey || normalizeTeeKey(tee.teeName)
    );

    setHandicapRows(buildHandicapRowsFromHoles(course.courseHoles));
    setScorecardRows(
      buildScorecardRows(course.holeCount, course.courseHoles, teeKeys)
    );
    scorecardHydratedRevision.current = revision;
  }, [step, course.id, course.updatedAt, course.holeCount, course.courseHoles, teeRows]);

  useEffect(() => {
    if (step !== "details") return;

    const location = resolveCourseLocation(course.country, course.state);
    setName(course.name);
    setAddress(course.address ?? "");
    setCountry(location.country);
    setCity(course.city ?? "");
    setState(location.region);
    setLatitude(parseCoordinate(course.latitude)?.toString() ?? "");
    setLongitude(parseCoordinate(course.longitude)?.toString() ?? "");
    setHoleCount(course.holeCount === 9 ? "9" : "18");
    setBackNineMirrorsFront(course.backNineMirrorsFront);
    setExternalCourseId(course.externalCourseId ?? null);
  }, [
    step,
    course.id,
    course.name,
    course.address,
    course.country,
    course.city,
    course.state,
    course.latitude,
    course.longitude,
    course.holeCount,
    course.backNineMirrorsFront,
    course.externalCourseId,
  ]);

  const mappingLayout = useMemo(
    () => ({
      holeCount: course.holeCount,
      backNineMirrorsFront: course.backNineMirrorsFront,
    }),
    [course.holeCount, course.backNineMirrorsFront]
  );
  const mappingHoleNumbers = useMemo(
    () => holeNumbersForMapping(mappingLayout),
    [mappingLayout]
  );
  const mappingHoleCount = mappingHoleNumbers.length;

  useEffect(() => {
    if (activeHole > mappingHoleCount) {
      setActiveHole(mappingHoleCount);
    }
  }, [activeHole, mappingHoleCount]);

  const sortedTees = useMemo(() => sortCourseTees(teeRows), [teeRows]);
  const sortedHandicapRows = useMemo(
    () => sortScorecardHandicapRows(handicapRows),
    [handicapRows]
  );
  const extractMensHandicap = sortedHandicapRows.some((row) => row.rowKey === "mens");
  const extractLadiesHandicap = sortedHandicapRows.some(
    (row) => row.rowKey === "ladies"
  );
  const mappingProgress = useMemo(
    () =>
      countCourseMappingProgress(
        course,
        course.courseTees,
        course.greenTargets,
        course.holeFeatures
      ),
    [course]
  );

  const holePins = useMemo(
    () => extractHolePinsFromFeatures(course.holeFeatures),
    [course.holeFeatures]
  );

  const activeHoleScorecardYardages = useMemo(() => {
    const hole = course.courseHoles.find(
      (entry) => entry.holeNumber === activeHole
    );
    if (!hole) return {};

    return Object.fromEntries(
      sortCourseTees(course.courseTees)
        .map((tee) => {
          const yardage = hole.teeYardages?.[tee.teeKey] ?? hole.yardage;
          return yardage != null ? [tee.teeKey, yardage] : null;
        })
        .filter((entry): entry is [string, number] => entry != null)
    );
  }, [activeHole, course.courseHoles, course.courseTees]);

  const mappedHoleNumbers = useMemo(
    () =>
      new Set(
        course.greenTargets
          .filter((target) => target.targetType === "middle")
          .map((target) => target.holeNumber)
      ),
    [course.greenTargets]
  );

  function syncScorecardRowsForTees(nextTees: CourseTeeInput[]) {
    const teeKeys = nextTees.map(
      (tee) => tee.teeKey || normalizeTeeKey(tee.teeName)
    );
    setScorecardRows((currentRows) => {
      const rebuilt = buildScorecardRows(
        course.holeCount,
        course.courseHoles,
        teeKeys
      );
      return rebuilt.map((row) => {
        const existing = currentRows.find(
          (entry) => entry.holeNumber === row.holeNumber
        );
        if (!existing) return row;

        return {
          ...row,
          par: existing.par,
          strokeIndex: existing.strokeIndex,
          ladiesStrokeIndex: existing.ladiesStrokeIndex,
          teeYardages: Object.fromEntries(
            teeKeys.map((teeKey) => [
              teeKey,
              existing.teeYardages[teeKey] ?? row.teeYardages[teeKey] ?? "",
            ])
          ),
        };
      });
    });
  }

  function addTeeFromPreset(preset: CourseTeeInput) {
    const teeKey = normalizeTeeKey(preset.teeKey);
    if (teeRows.some((tee) => normalizeTeeKey(tee.teeKey || tee.teeName) === teeKey)) {
      return;
    }
    const nextTees = [
      ...teeRows,
      {
        ...preset,
        teeKey,
        sortOrder: teeRows.length,
      },
    ];
    setTeeRows(nextTees);
    syncScorecardRowsForTees(nextTees);
  }

  function addCustomTee(rawName: string) {
    const teeName = rawName.trim();
    if (!teeName) return;

    const teeKey = normalizeTeeKey(teeName);
    if (
      teeRows.some((tee) => normalizeTeeKey(tee.teeKey || tee.teeName) === teeKey)
    ) {
      setError(`"${teeName}" is already in your tee list.`);
      return;
    }

    setError(null);
    const nextTees = [
      ...teeRows,
      {
        teeKey,
        teeName,
        teeColor: "#64748b",
        sortOrder: teeRows.length,
      },
    ];
    setTeeRows(nextTees);
    syncScorecardRowsForTees(nextTees);
    setCustomTeeName("");
  }

  function removeTee(teeKey: string) {
    if (teeRows.length <= 1) return;
    const nextTees = teeRows
      .filter((tee) => tee.teeKey !== teeKey)
      .map((tee, index) => ({ ...tee, sortOrder: index }));
    setTeeRows(nextTees);
    syncScorecardRowsForTees(nextTees);
  }

  function addHandicapRowFromPreset(preset: ScorecardHandicapRowInput) {
    if (handicapRows.some((row) => row.rowKey === preset.rowKey)) return;
    setHandicapRows([
      ...handicapRows,
      {
        ...preset,
        sortOrder: handicapRows.length,
      },
    ]);
  }

  function removeHandicapRow(rowKey: ScorecardHandicapRowKey) {
    setHandicapRows(
      handicapRows
        .filter((row) => row.rowKey !== rowKey)
        .map((row, index) => ({ ...row, sortOrder: index }))
    );
  }

  const courseCenter = useMemo(() => {
    const lat = parseCoordinate(course.latitude);
    const lng = parseCoordinate(course.longitude);
    return lat != null && lng != null ? { lat, lng } : { lat: 0, lng: 0 };
  }, [course.latitude, course.longitude]);

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    });
  }

  async function handleScorecardImage(file: File | null) {
    if (!file) return;

    setError(null);
    setMessage(null);
    setIsUploadingScorecard(true);

    try {
      const compressed = await compressScorecardImage(file);
      const formData = new FormData();
      formData.append("file", compressed);

      const response = await fetch(`/api/courses/${course.id}/scorecard-image`, {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Could not upload scorecard image.");
        return;
      }

      setScorecardImageUrl(payload.url);
      setMessage("Scorecard image uploaded.");
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload scorecard image."
      );
    } finally {
      setIsUploadingScorecard(false);
    }
  }

  function handleExtractScorecard() {
    if (!scorecardImageUrl) return;

    setError(null);
    setMessage(null);
    setOcrParValidation(null);
    setOcrYardageValidation([]);
    setOcrHandicapValidation([]);
    startTransition(async () => {
      const result = await extractCourseOnboardingScorecard(
        course.id,
        scorecardImageUrl,
        sortedTees,
        sortedHandicapRows
      );
      if (!result.success) {
        setError(result.error ?? "Could not extract scorecard.");
        return;
      }

      setScorecardRows(
        result.data.holes.map((hole) => ({
          holeNumber: hole.holeNumber,
          par: hole.par,
          strokeIndex: hole.strokeIndex,
          ladiesStrokeIndex: hole.ladiesStrokeIndex,
          teeYardages: hole.teeYardages,
        }))
      );
      setOcrParValidation(result.data.parValidation);
      setOcrYardageValidation(result.data.yardageValidation);
      setOcrHandicapValidation(result.data.handicapValidation);
      setMessage(
        `Extracted ${result.data.holes.length} holes — compare against the scorecard image.`
      );
    });
  }

  function isHoleMappingComplete(holeNumber: number) {
    const pins = holePins[holeNumber];
    const teeCount = course.courseTees.length;
    const placedTees = pins
      ? Object.keys(pins.tees).filter((key) =>
          course.courseTees.some((tee) => tee.teeKey === key)
        ).length
      : 0;
    return mappedHoleNumbers.has(holeNumber) && placedTees >= teeCount;
  }

  const mappingPercent =
    mappingProgress.requiredTeeCount > 0
      ? Math.round(
          (mappingProgress.mappedTeeCount / mappingProgress.requiredTeeCount) *
            100
        )
      : 0;

  return (
    <div className={cn("space-y-6", step === "mapping" && "space-y-4")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <CourseOnboardingStepTabs
          activeStep={step}
          onStepChange={setStep}
        />
        <Badge
          variant="outline"
          className="hidden shrink-0 capitalize sm:inline-flex"
        >
          {course.onboardingStatus}
        </Badge>
      </div>

      {course.onboardingStatus === "verified" && canEditVerifiedCourse && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          This verified course is editable. Use the steps above to update
          details, scorecard, or hole mapping.
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-primary">{message}</p>}

      {step === "details" && (
        <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
          <CourseGooglePlaceSearch
            id="courseGooglePlaceSearch"
            onPlaceSelect={(selection) => {
              setName(selection.name);
              setAddress(selection.address);
              setCountry(selection.country);
              setCity(selection.city);
              setState(selection.state);
              setLatitude(String(selection.latitude));
              setLongitude(String(selection.longitude));
              setExternalCourseId(selection.externalCourseId);
            }}
          />
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="courseName">Course name</FieldLabel>
            <Input
              id="courseName"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="courseAddress">Address</FieldLabel>
            <Input
              id="courseAddress"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel>Country</FieldLabel>
            <Select
              value={country}
              onValueChange={(value) => {
                const nextCountry = parseCourseCountry(value);
                setCountry(nextCountry);
                setState((current) => clearRegionIfInvalid(nextCountry, current));
              }}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COURSE_COUNTRIES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="courseCity">City</FieldLabel>
            <Input
              id="courseCity"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </Field>
          <CourseRegionSelect
            id="courseState"
            country={country}
            value={state}
            onChange={setState}
          />
          <Field>
            <FieldLabel htmlFor="courseLatitude">Latitude</FieldLabel>
            <Input
              id="courseLatitude"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="36.5685"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="courseLongitude">Longitude</FieldLabel>
            <Input
              id="courseLongitude"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="-121.9490"
            />
            <FieldDescription>
              Auto-filled from search when available. Edit if needed.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Hole count</FieldLabel>
            <Select
              value={holeCount}
              onValueChange={(value) => {
                if (value === "9" || value === "18") {
                  setHoleCount(value);
                  if (value === "9") {
                    setBackNineMirrorsFront(false);
                  }
                  setScorecardRows(
                    buildScorecardRows(
                      value === "9" ? 9 : 18,
                      course.courseHoles,
                      sortedTees.map((tee) => tee.teeKey)
                    )
                  );
                }
              }}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9">9 holes</SelectItem>
                <SelectItem value="18">18 holes</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {holeCount === "18" && (
            <Field className="sm:col-span-2">
              <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <FieldLabel htmlFor="backNineMirrorsFront">
                    Back nine mirrors front nine
                  </FieldLabel>
                  <FieldDescription>
                    Enable for 9-hole courses played twice as 18. Map holes 1–9
                    only; holes 10–18 reuse the same layout. Scorecard data stays
                    separate for all 18 holes.
                  </FieldDescription>
                </div>
                <Switch
                  id="backNineMirrorsFront"
                  checked={backNineMirrorsFront}
                  onCheckedChange={setBackNineMirrorsFront}
                />
              </div>
            </Field>
          )}
          <div className="sm:col-span-2">
            <CourseDuplicateWarning
              matches={duplicateCheck.matches}
              isChecking={duplicateCheck.isChecking}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              className="h-11 w-full sm:h-9 sm:w-auto"
              disabled={isPending || duplicateCheck.hasExactMatch}
              onClick={() =>
                runAction(async () => {
                  const lat = Number(latitude);
                  const lng = Number(longitude);
                  const result = await updateCourseOnboardingDetails(course.id, {
                    name,
                    address,
                    country,
                    city,
                    state,
                    latitude: lat,
                    longitude: lng,
                    holeCount: holeCount === "9" ? 9 : 18,
                    backNineMirrorsFront:
                      holeCount === "18" ? backNineMirrorsFront : false,
                    externalCourseId,
                    courseDetailsConfirmed: true,
                  });
                  if (result.success) setStep("scorecard");
                  return result;
                })
              }
            >
              Save and continue
            </Button>
          </div>
        </div>
      )}

      {step === "scorecard" && (
        <div className="space-y-5">
          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle>Scorecard layout</CardTitle>
              <CardDescription>
                Match the tee and handicap rows on your physical scorecard
                before extracting or editing hole data.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid lg:grid-cols-2 lg:divide-x">
                <div className="space-y-4 p-(--card-spacing)">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Tee rows</p>
                    <p className="text-xs text-muted-foreground">
                      Add each name printed on the scorecard — not the row
                      color.
                    </p>
                  </div>
                  <div className="flex min-h-9 flex-wrap items-center gap-2">
                    {sortedTees.map((tee) => (
                      <Badge
                        key={tee.teeKey}
                        variant="outline"
                        className="h-8 gap-1.5 px-2.5"
                      >
                        <span
                          className="inline-block size-2 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: tee.teeColor ?? "#64748b" }}
                        />
                        {tee.teeName}
                        {sortedTees.length > 1 && (
                          <button
                            type="button"
                            className="ml-0.5 text-muted-foreground hover:text-foreground"
                            aria-label={`Remove ${tee.teeName}`}
                            onClick={() => removeTee(tee.teeKey)}
                          >
                            ×
                          </button>
                        )}
                      </Badge>
                    ))}
                    {PRESET_COURSE_TEES.filter(
                      (preset) =>
                        !sortedTees.some(
                          (tee) => tee.teeKey === normalizeTeeKey(preset.teeKey)
                        )
                    ).map((preset) => (
                      <Button
                        key={preset.teeKey}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => addTeeFromPreset(preset)}
                      >
                        + {preset.teeName}
                      </Button>
                    ))}
                  </div>
                  <div className="flex max-w-md gap-2">
                    <Input
                      value={customTeeName}
                      placeholder="Custom name (e.g. Palmer)"
                      className="h-9"
                      onChange={(event) => setCustomTeeName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        addCustomTee(customTeeName);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0 px-3"
                      disabled={!customTeeName.trim()}
                      onClick={() => addCustomTee(customTeeName)}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 border-t p-(--card-spacing) lg:border-t-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Handicap rows</p>
                    <p className="text-xs text-muted-foreground">
                      Include every handicap row shown on the card.
                    </p>
                  </div>
                  <div className="flex min-h-9 flex-wrap items-center gap-2">
                    {sortedHandicapRows.map((row) => (
                      <Badge
                        key={row.rowKey}
                        variant="outline"
                        className="h-8 gap-1.5 px-2.5"
                      >
                        {row.rowName}
                        <button
                          type="button"
                          className="ml-0.5 text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${row.rowName}`}
                          onClick={() => removeHandicapRow(row.rowKey)}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                    {PRESET_SCORECARD_HANDICAP_ROWS.filter(
                      (preset) =>
                        !sortedHandicapRows.some(
                          (row) => row.rowKey === preset.rowKey
                        )
                    ).map((preset) => (
                      <Button
                        key={preset.rowKey}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => addHandicapRowFromPreset(preset)}
                      >
                        + {preset.rowName}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle>Scorecard reference</CardTitle>
              <CardDescription>
                Upload a photo and extract values, or enter hole data manually
                below.
              </CardDescription>
              {scorecardImageUrl && (
                <CardAction className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => setScorecardPreviewOpen(true)}
                  >
                    <Maximize2 className="size-3.5" />
                    Expand
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-xs"
                    disabled={isUploadingScorecard}
                    onClick={() => scorecardFileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" />
                    Replace
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <input
                ref={scorecardFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploadingScorecard}
                onChange={(event) =>
                  handleScorecardImage(event.target.files?.[0] ?? null)
                }
              />
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                {scorecardImageUrl ? (
                  <button
                    type="button"
                    className="group relative mx-auto w-full shrink-0 overflow-hidden rounded-lg border bg-muted/30 lg:mx-0 lg:w-56 xl:w-64"
                    onClick={() => setScorecardPreviewOpen(true)}
                  >
                    <Image
                      src={scorecardImageUrl}
                      alt="Scorecard reference"
                      width={640}
                      height={480}
                      className="h-auto max-h-72 w-full object-contain p-2 transition-opacity group-hover:opacity-90"
                      unoptimized
                    />
                  </button>
                ) : (
                  <label
                    className={cn(
                      "flex min-h-44 w-full shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40 lg:w-56 xl:w-64",
                      isUploadingScorecard && "pointer-events-none opacity-60"
                    )}
                  >
                    <Upload className="size-5" />
                    <span className="font-medium text-foreground">
                      {isUploadingScorecard
                        ? "Uploading…"
                        : "Upload scorecard photo"}
                    </span>
                    <span className="text-xs">
                      JPG or PNG · clear, flat, full card visible
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingScorecard}
                      onChange={(event) =>
                        handleScorecardImage(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  {scorecardImageUrl ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Compare the extracted hole data below against your
                        scorecard photo. Use Expand for a full-size view.
                      </p>
                      <Button
                        type="button"
                        className="h-10 w-full sm:w-auto sm:self-start"
                        disabled={
                          isPending ||
                          sortedTees.length === 0 ||
                          sortedHandicapRows.length === 0
                        }
                        onClick={handleExtractScorecard}
                      >
                        <ScanLine />
                        {isPending ? "Extracting…" : "Extract with AI"}
                      </Button>
                      {(sortedTees.length === 0 ||
                        sortedHandicapRows.length === 0) && (
                        <p className="text-xs text-muted-foreground">
                          Add at least one tee row and one handicap row before
                          extracting.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Upload a clear photo of the full scorecard to auto-fill
                      par, yardages, and handicaps. You can also enter values
                      manually in the table below.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle>Hole data</CardTitle>
              <CardDescription>
                Front and back nine side by side. Edit any cell that
                doesn&apos;t match the scorecard image.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CourseScorecardEditTable
                holeCount={course.holeCount}
                rows={scorecardRows}
                sortedTees={sortedTees}
                showMensHandicap={extractMensHandicap}
                showLadiesHandicap={extractLadiesHandicap}
                onRowsChange={setScorecardRows}
              />
            </CardContent>
          </Card>

          {(ocrParValidation ||
            ocrYardageValidation.length > 0 ||
            ocrHandicapValidation.length > 0) && (
            <ScorecardOcrTotalsPanel
              parValidation={ocrParValidation}
              yardageValidation={ocrYardageValidation}
              handicapValidation={ocrHandicapValidation}
            />
          )}

          <Sheet open={scorecardPreviewOpen} onOpenChange={setScorecardPreviewOpen}>
            <SheetContent
              side="right"
              className="w-full! gap-0 p-0 sm:max-w-[min(96vw,1200px)]!"
            >
              <SheetHeader className="shrink-0 border-b px-4 py-3">
                <SheetTitle>Scorecard reference</SheetTitle>
              </SheetHeader>
              {scorecardImageUrl && (
                <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-2 sm:p-4">
                  {/* Native img so expand view renders at full container width */}
                  <img
                    src={scorecardImageUrl}
                    alt="Scorecard full view"
                    className="mx-auto block h-auto w-full max-w-none rounded-md"
                  />
                </div>
              )}
            </SheetContent>
          </Sheet>

          <div className="flex justify-end border-t pt-4">
            <Button
              type="button"
              className="h-11 w-full sm:h-9 sm:w-auto"
              disabled={isPending}
              onClick={() =>
                runAction(async () => {
                  const result = await saveCourseOnboardingScorecard(course.id, {
                    tees: sortedTees.map((tee, index) => ({
                      teeKey: tee.teeKey || normalizeTeeKey(tee.teeName),
                      teeName: tee.teeName,
                      teeColor: tee.teeColor,
                      sortOrder: index,
                    })),
                    holes: scorecardRows.map((row) => ({
                      holeNumber: row.holeNumber,
                      par: row.par,
                      strokeIndex: row.strokeIndex.trim()
                        ? Number(row.strokeIndex)
                        : null,
                      ladiesStrokeIndex: row.ladiesStrokeIndex.trim()
                        ? Number(row.ladiesStrokeIndex)
                        : null,
                      teeYardages: Object.fromEntries(
                        sortedTees.map((tee) => [
                          tee.teeKey,
                          row.teeYardages[tee.teeKey]?.trim()
                            ? Number(row.teeYardages[tee.teeKey])
                            : null,
                        ])
                      ),
                    })),
                  });
                  if (result.success) setStep("mapping");
                  return result;
                })
              }
            >
              Save scorecard and map holes
            </Button>
          </div>
        </div>
      )}

      {step === "mapping" && (
        <div className="space-y-3">
          {course.backNineMirrorsFront && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
              This course is played twice through the same nine holes. Map holes
              1–9 only; holes 10–18 reuse this layout during live play.
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Select a hole, place the green and each tee box, then choose
              Straight or Dogleg for the fairway path. Completed holes lock
              automatically.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 w-full shrink-0 sm:h-8 sm:w-auto"
              disabled={isPending || course.courseTees.length === 0}
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  const result = await prefillCourseOnboardingFromOsm(course.id);
                  if (!result.success) {
                    setError(result.error ?? "Could not prefill from OSM.");
                    return;
                  }

                  const { coverage, appliedHoleCount } = result;
                  setMessage(
                    `Prefilled ${appliedHoleCount} holes from OpenStreetMap (${coverage.greensFound}/${coverage.totalHoles} greens, ${coverage.holeLinesFound} hole lines). Review each hole before submitting.`
                  );
                  router.refresh();
                });
              }}
            >
              <Sparkles />
              Prefill from OpenStreetMap
            </Button>
          </div>

          <div className="mx-auto w-full overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b bg-muted/20 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Hole {activeHole}
                  </p>
                  <span className="hidden h-4 w-px bg-border sm:inline-block" />
                  <p className="text-xs text-muted-foreground">
                    {mappingProgress.mappedHoleCount}/{mappingHoleCount} greens
                    · {mappingProgress.mappedTeeCount}/
                    {mappingProgress.requiredTeeCount} tees
                  </p>
                  <div className="flex min-w-28 flex-1 items-center gap-2 sm:max-w-xs">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${mappingPercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium tabular-nums text-primary">
                      {mappingPercent}%
                    </span>
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-2 lg:flex">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={activeHole <= 1}
                    onClick={() => setActiveHole((current) => current - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={activeHole >= mappingHoleCount}
                    onClick={() => setActiveHole((current) => current + 1)}
                  >
                    Next hole
                    <ChevronRight />
                  </Button>
                  {mappingProgress.isComplete && (
                    <Button type="button" size="sm" onClick={() => setStep("review")}>
                      Continue to review
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <HoleStrip
              holes={mappingHoleNumbers}
              activeHole={activeHole}
              onSelect={setActiveHole}
              isHoleComplete={isHoleMappingComplete}
            />

            <div className="min-h-[min(52vh,560px)] min-w-0 lg:min-h-[min(78vh,820px)]">
              <CourseHolePinMap
                className="h-full min-h-[min(52vh,560px)] lg:min-h-[min(78vh,820px)]"
                courseCenter={courseCenter}
                holeNumber={activeHole}
                courseTees={course.courseTees}
                initialGreen={holePins[activeHole]?.green ?? null}
                initialTees={holePins[activeHole]?.tees ?? {}}
                initialLineBreak={holePins[activeHole]?.lineBreak ?? null}
                scorecardYardages={activeHoleScorecardYardages}
                isSaving={isPending}
                canGoPrevious={activeHole > 1}
                canGoNext={activeHole < mappingHoleCount}
                onPreviousHole={() =>
                  setActiveHole((current) => Math.max(1, current - 1))
                }
                onNextHole={() =>
                  setActiveHole((current) =>
                    Math.min(mappingHoleCount, current + 1)
                  )
                }
                onSavePin={async (pin) => {
                  setError(null);
                  const result = await saveCourseOnboardingHolePin(
                    course.id,
                    activeHole,
                    pin
                  );
                  if (!result.success) {
                    setError(result.error ?? "Could not save pin.");
                    return;
                  }
                  setMessage(
                    pin.kind === "green"
                      ? `Saved green for hole ${activeHole}.`
                      : pin.kind === "tee"
                        ? `Saved tee for hole ${activeHole}.`
                        : pin.kind === "line_break"
                          ? `Updated fairway line for hole ${activeHole}.`
                          : pin.enabled
                            ? `Enabled dogleg for hole ${activeHole}.`
                            : `Set hole ${activeHole} to a straight path.`
                  );
                  startTransition(() => {
                    router.refresh();
                  });
                }}
              />
            </div>

            <div className="space-y-2 border-t px-4 py-3 lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1"
                  disabled={activeHole <= 1}
                  onClick={() => setActiveHole((current) => current - 1)}
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {activeHole} / {mappingHoleCount}
                  {course.backNineMirrorsFront && (
                    <span className="text-muted-foreground">
                      {" "}
                      (18-hole scorecard)
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1"
                  disabled={activeHole >= mappingHoleCount}
                  onClick={() => setActiveHole((current) => current + 1)}
                >
                  Next
                  <ChevronRight />
                </Button>
              </div>
              {mappingProgress.isComplete && (
                <Button
                  type="button"
                  className="h-10 w-full"
                  onClick={() => setStep("review")}
                >
                  Continue to review
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium">{course.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatCourseLocationLine({
                  city: course.city,
                  state: course.state,
                  country: course.country,
                })}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>
                {course.holeCount} holes
                {course.backNineMirrorsFront && " · 9 physical layouts"}
              </p>
              <p>
                {course.courseTees.length} tee sets · {mappingProgress.mappedTeeCount}{" "}
                tee boxes mapped
              </p>
            </div>
          </div>

          {course.onboardingStatus === "verified" && (
            <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <CheckCircle2 className="size-4 text-primary" />
              {canEditVerifiedCourse
                ? "Verified and published. You can edit this course."
                : "This course is verified and published for Caddie Mode."}
            </div>
          )}

          {course.onboardingStatus === "submitted" && (
            <p className="text-sm text-muted-foreground">
              Submitted for platform review. You will be notified once it is
              verified.
            </p>
          )}

          {course.onboardingStatus === "rejected" && course.reviewNotes && (
            <p className="text-sm text-destructive">{course.reviewNotes}</p>
          )}

          {course.onboardingStatus !== "verified" &&
            course.onboardingStatus !== "submitted" && (
              <Button
                type="button"
                disabled={
                  isPending ||
                  !mappingProgress.isComplete ||
                  course.courseHoles.length < course.holeCount ||
                  course.courseTees.length === 0
                }
                onClick={() =>
                  runAction(() => submitCourseForVerification(course.id))
                }
              >
                Submit for verification
              </Button>
            )}

          {course.onboardingStatus === "rejected" && (
            <Button type="button" variant="outline" onClick={() => setStep("mapping")}>
              <MapPin />
              Update hole mapping
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
