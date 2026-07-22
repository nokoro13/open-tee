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
import { CourseHolePinMap } from "@/components/dashboard/course-hole-pin-map";
import { HoleStrip } from "@/components/dashboard/hole-strip";
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
import { parseCoordinate } from "@/lib/green-distance";
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

function TotalCheckCell({
  holeSum,
  expected,
  matches,
}: {
  holeSum: number | null;
  expected: number | null;
  matches: boolean;
}) {
  if (holeSum == null && expected == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const hasComparison = holeSum != null && expected != null;

  return (
    <span
      className={cn(
        "tabular-nums",
        hasComparison && matches && "text-emerald-700 dark:text-emerald-300",
        hasComparison && !matches && "font-medium text-amber-800 dark:text-amber-200"
      )}
    >
      {holeSum ?? "—"}/{expected ?? "—"}
      {hasComparison && (matches ? " ✓" : " ✗")}
    </span>
  );
}

function ScorecardTotalsPanel({
  parValidation,
  yardageValidation,
  handicapValidation,
}: {
  parValidation: ScorecardParValidation | null;
  yardageValidation: ScorecardYardageValidation[];
  handicapValidation: ScorecardStrokeIndexValidation[];
}) {
  if (
    !parValidation &&
    yardageValidation.length === 0 &&
    handicapValidation.length === 0
  ) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
      <p className="font-medium text-foreground">Totals check</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-70">
          <thead>
            <tr className="text-muted-foreground">
              <th className="pr-3 pb-1 text-left font-medium">Row</th>
              <th className="px-2 pb-1 text-left font-medium">OUT</th>
              <th className="px-2 pb-1 text-left font-medium">IN</th>
              <th className="pl-2 pb-1 text-left font-medium">TOT</th>
            </tr>
          </thead>
          <tbody>
            {parValidation && (
              <tr>
                <td className="pr-3 py-1 font-medium">Par</td>
                <td className="px-2 py-1">
                  <TotalCheckCell
                    holeSum={parValidation.frontSum}
                    expected={parValidation.frontExpected}
                    matches={parValidation.frontMatches}
                  />
                </td>
                <td className="px-2 py-1">
                  <TotalCheckCell
                    holeSum={parValidation.backSum}
                    expected={parValidation.backExpected}
                    matches={parValidation.backMatches}
                  />
                </td>
                <td className="pl-2 py-1">
                  <TotalCheckCell
                    holeSum={parValidation.totalSum}
                    expected={parValidation.totalExpected}
                    matches={parValidation.totalMatches}
                  />
                </td>
              </tr>
            )}
            {yardageValidation.map((entry) => (
              <tr key={entry.teeKey}>
                <td className="pr-3 py-1 font-medium">{entry.teeName}</td>
                <td className="px-2 py-1">
                  <TotalCheckCell
                    holeSum={entry.totals.frontSum}
                    expected={entry.totals.frontExpected}
                    matches={entry.totals.frontMatches}
                  />
                </td>
                <td className="px-2 py-1">
                  <TotalCheckCell
                    holeSum={entry.totals.backSum}
                    expected={entry.totals.backExpected}
                    matches={entry.totals.backMatches}
                  />
                </td>
                <td className="pl-2 py-1">
                  <TotalCheckCell
                    holeSum={entry.totals.totalSum}
                    expected={entry.totals.totalExpected}
                    matches={entry.totals.totalMatches}
                  />
                </td>
              </tr>
            ))}
            {handicapValidation.map((entry) => (
              <tr key={entry.label}>
                <td className="pr-3 py-1 font-medium">{entry.label}</td>
                <td className="px-2 py-1" colSpan={3}>
                  <span
                    className={cn(
                      "tabular-nums",
                      entry.isValidPermutation &&
                        "text-emerald-700 dark:text-emerald-300",
                      !entry.isValidPermutation &&
                        "font-medium text-amber-800 dark:text-amber-200"
                    )}
                  >
                    {entry.sum ?? "—"}/{entry.expectedSum}
                    {entry.sum != null &&
                      (entry.isValidPermutation ? " ✓" : " ✗")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
  ]);

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
          </Field>
          <Field>
            <FieldLabel>Hole count</FieldLabel>
            <Select
              value={holeCount}
              onValueChange={(value) => {
                if (value === "9" || value === "18") {
                  setHoleCount(value);
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
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card size="sm">
              <CardHeader className="border-b">
                <CardTitle>Tee rows</CardTitle>
                <CardDescription>
                  Add each name printed on the scorecard — not the row color.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {sortedTees.map((tee) => (
                    <Badge
                      key={tee.teeKey}
                      variant="outline"
                      className="gap-1.5 px-2 py-0.5"
                    >
                      <span
                        className="inline-block size-2 rounded-full border"
                        style={{ backgroundColor: tee.teeColor ?? "#64748b" }}
                      />
                      {tee.teeName}
                      {sortedTees.length > 1 && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => removeTee(tee.teeKey)}
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
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
                      className="h-7 px-2 text-xs"
                      onClick={() => addTeeFromPreset(preset)}
                    >
                      + {preset.teeName}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customTeeName}
                    placeholder="Custom name (e.g. Palmer)"
                    className="h-8 text-xs"
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
                    className="h-8 shrink-0 px-2 text-xs"
                    disabled={!customTeeName.trim()}
                    onClick={() => addCustomTee(customTeeName)}
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader className="border-b">
                <CardTitle>Handicap rows</CardTitle>
                <CardDescription>
                  Include every handicap row shown on the card.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {sortedHandicapRows.map((row) => (
                    <Badge
                      key={row.rowKey}
                      variant="outline"
                      className="gap-1.5 px-2 py-0.5"
                    >
                      {row.rowName}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => removeHandicapRow(row.rowKey)}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
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
                      className="h-7 px-2 text-xs"
                      onClick={() => addHandicapRowFromPreset(preset)}
                    >
                      + {preset.rowName}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(300px,2fr)_minmax(0,3fr)]">
            <Card size="sm" className="xl:sticky xl:top-4 xl:self-start">
              <CardHeader className="border-b">
                <CardTitle>Scorecard reference</CardTitle>
                <CardDescription>
                  Verify extracted values against the original photo.
                </CardDescription>
                {scorecardImageUrl && (
                  <CardAction className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setScorecardPreviewOpen(true)}
                    >
                      <Maximize2 className="size-3.5" />
                      Expand
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      disabled={isUploadingScorecard}
                      onClick={() => scorecardFileInputRef.current?.click()}
                    >
                      <Upload className="size-3.5" />
                      Replace
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
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
                {scorecardImageUrl ? (
                  <>
                    <button
                      type="button"
                      className="group relative block w-full overflow-hidden rounded-lg border bg-muted/30"
                      onClick={() => setScorecardPreviewOpen(true)}
                    >
                      <div className="relative min-h-[min(52vh,560px)] w-full">
                        <Image
                          src={scorecardImageUrl}
                          alt="Scorecard reference"
                          fill
                          className="object-contain p-2 transition-opacity group-hover:opacity-90"
                          unoptimized
                        />
                      </div>
                      <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/90 to-transparent px-3 py-2 text-left text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        Click to expand
                      </span>
                    </button>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        className="h-11 w-full sm:h-9"
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
                    </div>
                    {(sortedTees.length === 0 ||
                      sortedHandicapRows.length === 0) && (
                      <p className="text-xs text-muted-foreground">
                        Add at least one tee row and one handicap row before
                        extracting.
                      </p>
                    )}
                    {(ocrParValidation ||
                      ocrYardageValidation.length > 0 ||
                      ocrHandicapValidation.length > 0) && (
                      <ScorecardTotalsPanel
                        parValidation={ocrParValidation}
                        yardageValidation={ocrYardageValidation}
                        handicapValidation={ocrHandicapValidation}
                      />
                    )}
                  </>
                ) : (
                  <label
                    className={cn(
                      "flex min-h-[min(40vh,360px)] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40",
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
              </CardContent>
            </Card>

            <Card size="sm" className="min-w-0">
              <CardHeader className="border-b">
                <CardTitle>Extracted data</CardTitle>
                <CardDescription>
                  Edit any cell that doesn&apos;t match the scorecard image.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="sticky left-0 z-10 bg-muted/30 px-2 py-1.5 font-medium after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border">
                          #
                        </th>
                        <th className="px-1.5 py-1.5 font-medium">Par</th>
                        {sortedTees.map((tee) => (
                          <th
                            key={tee.teeKey}
                            className="whitespace-nowrap px-1.5 py-1.5 font-medium"
                            title={tee.teeName}
                          >
                            {tee.teeName}
                          </th>
                        ))}
                        {extractMensHandicap && (
                          <th className="px-1.5 py-1.5 font-medium">M HCP</th>
                        )}
                        {extractLadiesHandicap && (
                          <th className="px-1.5 py-1.5 font-medium">L HCP</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {scorecardRows.map((row, index) => (
                        <tr
                          key={row.holeNumber}
                          className={cn(
                            row.holeNumber === 10 &&
                              "border-t-2 border-border bg-muted/10"
                          )}
                        >
                          <td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium tabular-nums after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border">
                            {row.holeNumber}
                          </td>
                          <td className="px-1 py-1">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={3}
                              max={5}
                              className="h-8 w-12 px-1 text-center text-xs tabular-nums"
                              value={row.par}
                              onChange={(event) => {
                                const next = [...scorecardRows];
                                next[index] = {
                                  ...row,
                                  par: Number(event.target.value),
                                };
                                setScorecardRows(next);
                              }}
                            />
                          </td>
                          {sortedTees.map((tee) => (
                            <td key={tee.teeKey} className="px-1 py-1">
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                className="h-8 w-14 px-1 text-center text-xs tabular-nums"
                                value={row.teeYardages[tee.teeKey] ?? ""}
                                onChange={(event) => {
                                  const next = [...scorecardRows];
                                  next[index] = {
                                    ...row,
                                    teeYardages: {
                                      ...row.teeYardages,
                                      [tee.teeKey]: event.target.value,
                                    },
                                  };
                                  setScorecardRows(next);
                                }}
                              />
                            </td>
                          ))}
                          {extractMensHandicap && (
                            <td className="px-1 py-1">
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={18}
                                className="h-8 w-12 px-1 text-center text-xs tabular-nums"
                                value={row.strokeIndex}
                                onChange={(event) => {
                                  const next = [...scorecardRows];
                                  next[index] = {
                                    ...row,
                                    strokeIndex: event.target.value,
                                  };
                                  setScorecardRows(next);
                                }}
                              />
                            </td>
                          )}
                          {extractLadiesHandicap && (
                            <td className="px-1 py-1">
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={18}
                                className="h-8 w-12 px-1 text-center text-xs tabular-nums"
                                value={row.ladiesStrokeIndex}
                                onChange={(event) => {
                                  const next = [...scorecardRows];
                                  next[index] = {
                                    ...row,
                                    ladiesStrokeIndex: event.target.value,
                                  };
                                  setScorecardRows(next);
                                }}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

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
                    {mappingProgress.mappedHoleCount}/{course.holeCount} greens
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
                    disabled={activeHole >= course.holeCount}
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
              holes={holeNumbersForCount(course.holeCount)}
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
                canGoNext={activeHole < course.holeCount}
                onPreviousHole={() =>
                  setActiveHole((current) => Math.max(1, current - 1))
                }
                onNextHole={() =>
                  setActiveHole((current) =>
                    Math.min(course.holeCount, current + 1)
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
                  {activeHole} / {course.holeCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1"
                  disabled={activeHole >= course.holeCount}
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
              <p>{course.holeCount} holes</p>
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
