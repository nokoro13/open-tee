"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, MapPin, Upload } from "lucide-react";

import {
  saveCourseOnboardingHolePin,
  saveCourseOnboardingScorecard,
  saveCourseOnboardingScorecardImage,
  submitCourseForVerification,
  updateCourseOnboardingDetails,
} from "@/actions/course-onboarding";
import { CourseHolePinMap } from "@/components/dashboard/course-hole-pin-map";
import { Badge } from "@/components/ui/badge";
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
import type {
  CourseHole,
  CourseTee,
  GolfCourse,
  GreenTarget,
  HoleFeature,
} from "@/db/schema";
import { parseCoordinate } from "@/lib/green-distance";
import { cn } from "@/lib/utils";

type ScorecardRow = {
  holeNumber: number;
  par: number;
  strokeIndex: string;
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
};

const STEPS: { id: CourseOnboardingStep; label: string }[] = [
  { id: "details", label: "Course details" },
  { id: "scorecard", label: "Scorecard" },
  { id: "mapping", label: "Hole mapping" },
  { id: "review", label: "Review" },
];

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
}: CourseOnboardingWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<CourseOnboardingStep>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeHole, setActiveHole] = useState(1);

  const [name, setName] = useState(course.name);
  const [address, setAddress] = useState(course.address ?? "");
  const [city, setCity] = useState(course.city ?? "");
  const [state, setState] = useState(course.state ?? "");
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
  const [scorecardRows, setScorecardRows] = useState<ScorecardRow[]>(() =>
    buildScorecardRows(
      course.holeCount,
      course.courseHoles,
      buildTeeRows(course.courseTees).map((tee) => tee.teeKey)
    )
  );

  const sortedTees = useMemo(() => sortCourseTees(teeRows), [teeRows]);
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
    setScorecardRows(buildScorecardRows(course.holeCount, course.courseHoles, teeKeys));
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

  function removeTee(teeKey: string) {
    if (teeRows.length <= 1) return;
    const nextTees = teeRows
      .filter((tee) => tee.teeKey !== teeKey)
      .map((tee, index) => ({ ...tee, sortOrder: index }));
    setTeeRows(nextTees);
    syncScorecardRowsForTees(nextTees);
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

  function handleScorecardImage(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      setScorecardImageUrl(dataUrl);
      runAction(() => saveCourseOnboardingScorecardImage(course.id, dataUrl));
    };
    reader.readAsDataURL(file);
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

  const holeSections = useMemo(() => {
    const holes = holeNumbersForCount(course.holeCount);
    if (course.holeCount === 18) {
      return [
        { label: "Front nine", holes: holes.slice(0, 9) },
        { label: "Back nine", holes: holes.slice(9, 18) },
      ];
    }
    return [{ label: "Holes", holes }];
  }, [course.holeCount]);

  return (
    <div className={cn("space-y-6", step === "mapping" && "space-y-4")}>
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((entry, index) => (
          <Button
            key={entry.id}
            type="button"
            size="sm"
            variant={step === entry.id ? "default" : "outline"}
            onClick={() => setStep(entry.id)}
            className={cn(step === "mapping" && "h-8 px-3 text-xs")}
          >
            <span className="mr-1.5 hidden text-muted-foreground sm:inline">
              {index + 1}.
            </span>
            {entry.label}
          </Button>
        ))}
        <Badge variant="outline" className="ml-auto capitalize">
          {course.onboardingStatus}
        </Badge>
      </div>

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
          <Field>
            <FieldLabel htmlFor="courseCity">City</FieldLabel>
            <Input
              id="courseCity"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="courseState">State</FieldLabel>
            <Input
              id="courseState"
              value={state}
              onChange={(event) => setState(event.target.value)}
            />
          </Field>
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
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(async () => {
                  const lat = Number(latitude);
                  const lng = Number(longitude);
                  const result = await updateCourseOnboardingDetails(course.id, {
                    name,
                    address,
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
        <div className="space-y-4 rounded-lg border p-4">
          <Field>
            <FieldLabel>Scorecard photo</FieldLabel>
            <FieldDescription>
              Upload a photo of the official scorecard for reference during
              verification.
            </FieldDescription>
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground hover:bg-muted/40">
              <Upload className="size-4" />
              <span>Upload scorecard image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) =>
                  handleScorecardImage(event.target.files?.[0] ?? null)
                }
              />
            </label>
            {scorecardImageUrl && (
              <div className="relative mt-3 h-48 w-full overflow-hidden rounded-md border">
                <Image
                  src={scorecardImageUrl}
                  alt="Scorecard reference"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel>Tee sets</FieldLabel>
            <FieldDescription>
              Add every tee color on the scorecard. You will place one tee box per
              color on each hole during mapping.
            </FieldDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              {sortedTees.map((tee) => (
                <Badge key={tee.teeKey} variant="outline" className="gap-2 px-3 py-1">
                  <span
                    className="inline-block size-2.5 rounded-full border"
                    style={{ backgroundColor: tee.teeColor ?? "#2563eb" }}
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
            <div className="mt-3 flex flex-wrap gap-2">
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
                  onClick={() => addTeeFromPreset(preset)}
                >
                  + {preset.teeName}
                </Button>
              ))}
            </div>
          </Field>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2">Hole</th>
                  <th className="px-2 py-2">Par</th>
                  {sortedTees.map((tee) => (
                    <th key={tee.teeKey} className="px-2 py-2">
                      {tee.teeName} yds
                    </th>
                  ))}
                  <th className="px-2 py-2">HCP</th>
                </tr>
              </thead>
              <tbody>
                {scorecardRows.map((row, index) => (
                  <tr key={row.holeNumber} className="border-b">
                    <td className="px-2 py-2 font-medium">{row.holeNumber}</td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min={3}
                        max={5}
                        className="h-9 w-20"
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
                      <td key={tee.teeKey} className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          className="h-9 w-24"
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
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min={1}
                        max={18}
                        className="h-9 w-20"
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
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
      )}

      {step === "mapping" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select a hole, place the green and each tee box, then drag fairway
            anchors for doglegs. Completed holes lock automatically.
          </p>

          <div className="mx-auto w-full overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="grid min-h-[min(78vh,820px)] lg:grid-cols-[14rem_1fr]">
              <aside className="flex flex-col border-b bg-muted/20 lg:border-b-0 lg:border-r">
                <div className="space-y-3 border-b px-4 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Course progress
                    </p>
                    <span className="text-xs font-medium text-primary">
                      {mappingPercent}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${mappingPercent}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="rounded-md bg-background/80 px-2.5 py-2 ring-1 ring-foreground/5">
                      <p className="font-medium text-foreground">
                        {mappingProgress.mappedHoleCount}/{course.holeCount}
                      </p>
                      <p>Greens</p>
                    </div>
                    <div className="rounded-md bg-background/80 px-2.5 py-2 ring-1 ring-foreground/5">
                      <p className="font-medium text-foreground">
                        {mappingProgress.mappedTeeCount}/
                        {mappingProgress.requiredTeeCount}
                      </p>
                      <p>Tee boxes</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
                  {holeSections.map((section) => (
                    <div key={section.label}>
                      <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {section.label}
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {section.holes.map((holeNumber) => {
                          const complete = isHoleMappingComplete(holeNumber);
                          const isActive = activeHole === holeNumber;

                          return (
                            <button
                              key={holeNumber}
                              type="button"
                              onClick={() => setActiveHole(holeNumber)}
                              className={cn(
                                "relative flex h-9 items-center justify-center rounded-md text-sm font-medium transition-colors",
                                isActive
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "bg-background/80 text-foreground ring-1 ring-foreground/10 hover:bg-background",
                                complete && !isActive && "ring-primary/30"
                              )}
                            >
                              {holeNumber}
                              {complete && (
                                <CheckCircle2
                                  className={cn(
                                    "absolute -right-1 -top-1 size-3.5",
                                    isActive
                                      ? "text-primary-foreground"
                                      : "text-primary"
                                  )}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 border-t p-3">
                  <div className="grid grid-cols-[auto_1fr_auto] gap-2">
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
                      className="w-full"
                      disabled={activeHole >= course.holeCount}
                      onClick={() => setActiveHole((current) => current + 1)}
                    >
                      Next hole
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={activeHole >= course.holeCount}
                      onClick={() => setActiveHole((current) => current + 1)}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                  {mappingProgress.isComplete && (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => setStep("review")}
                    >
                      Continue to review
                    </Button>
                  )}
                </div>
              </aside>

              <div className="min-h-[min(52vh,560px)] min-w-0 lg:min-h-0">
                <CourseHolePinMap
                  className="h-full min-h-[min(52vh,560px)] lg:min-h-full"
                  courseCenter={courseCenter}
                  holeNumber={activeHole}
                  courseTees={course.courseTees}
                  initialGreen={holePins[activeHole]?.green ?? null}
                  initialTees={holePins[activeHole]?.tees ?? {}}
                  initialLineBreaks={holePins[activeHole]?.lineBreaks ?? {}}
                  isSaving={isPending}
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
                          : `Updated fairway line for hole ${activeHole}.`
                    );
                    startTransition(() => {
                      router.refresh();
                    });
                  }}
                />
              </div>
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
                {[course.city, course.state].filter(Boolean).join(", ")}
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
              This course is verified and published for Caddie Mode.
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
