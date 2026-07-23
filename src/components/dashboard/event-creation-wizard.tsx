"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Calendar, Flag, MapPin, Users } from "lucide-react";

import { createEvent, type EventFormInput } from "@/actions/events";
import { CoursePicker } from "@/components/dashboard/course-picker";
import {
  EventCreationStepper,
  type EventCreationStep,
} from "@/components/dashboard/event-creation-stepper";
import {
  defaultStartFormatFieldValues,
  StartFormatFields,
  type StartFormatFieldValues,
} from "@/components/dashboard/start-format-fields";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  currencyFormatValue,
  currencyParseValue,
  ENTRY_FEE_PRESETS,
  MAX_PLAYERS_PRESETS,
  NumericStepperInput,
} from "@/components/ui/numeric-stepper-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyCourseSelection,
  type CourseSelection,
} from "@/lib/course-selection";
import {
  DEFAULT_TEAM_A_NAME,
  DEFAULT_TEAM_B_NAME,
  EVENT_FORMATS,
  FORMAT_CATEGORIES,
  getEventFormat,
  getEventFormatLabel,
  type EventFormat,
} from "@/lib/event-formats";
import { formatEventDate, formatFee } from "@/lib/events";
import {
  getStartFormatSummary,
  validateStartFormatSettings,
} from "@/lib/start-format";

const STEPS: EventCreationStep[] = [
  { id: "name", label: "Name" },
  { id: "date", label: "Date" },
  { id: "format", label: "Format" },
  { id: "course", label: "Course" },
  { id: "schedule", label: "Schedule" },
  { id: "registration", label: "Registration" },
  { id: "review", label: "Review" },
];

const STEP_COPY: Record<
  string,
  { title: string; description: string; icon?: React.ReactNode }
> = {
  name: {
    title: "What's your event called?",
    description: "Choose a name players will recognize on registration and scorecards.",
  },
  date: {
    title: "When is it happening?",
    description: "Pick the date of your tournament or outing.",
  },
  format: {
    title: "How will you play?",
    description: "Choose the tournament format and number of holes.",
  },
  course: {
    title: "Where are you playing?",
    description: "Search the verified course catalog to attach an official scorecard.",
  },
  schedule: {
    title: "When do groups start?",
    description: "Set shotgun or tee times now — you can adjust pairings after publishing.",
  },
  registration: {
    title: "Registration settings",
    description: "Set capacity, entry fee, and an optional description for players.",
  },
  review: {
    title: "Review your event",
    description: "Confirm everything looks right, then save your draft.",
  },
};

type EventCreationWizardInitialValues = {
  name?: string;
  date?: string;
  format?: EventFormat;
  holes?: EventFormInput["holes"];
  maxPlayers?: number;
  entryFeeDollars?: number;
  description?: string;
  courseSelection?: CourseSelection;
  startFormatValues?: StartFormatFieldValues;
};

type EventCreationWizardProps = {
  defaultFormat?: EventFormat;
  preview?: boolean;
  initialStepIndex?: number;
  initialValues?: EventCreationWizardInitialValues;
};

export function EventCreationWizard({
  defaultFormat,
  preview = false,
  initialStepIndex = 0,
  initialValues,
}: EventCreationWizardProps) {
  const [isPending, startTransition] = useTransition();
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [error, setError] = useState<string | null>(null);

  const [courseSelection, setCourseSelection] = useState<CourseSelection>(
    () => initialValues?.courseSelection ?? emptyCourseSelection()
  );
  const [startFormatValues, setStartFormatValues] = useState<StartFormatFieldValues>(
    () =>
      initialValues?.startFormatValues ?? defaultStartFormatFieldValues()
  );
  const [form, setForm] = useState({
    name: initialValues?.name ?? "",
    date: initialValues?.date ?? "",
    format: initialValues?.format ?? defaultFormat ?? ("scramble" as EventFormat),
    holes: initialValues?.holes ?? ("18" as EventFormInput["holes"]),
    maxPlayers: initialValues?.maxPlayers ?? 72,
    entryFeeDollars: initialValues?.entryFeeDollars ?? 0,
    description: initialValues?.description ?? "",
    teamAName: DEFAULT_TEAM_A_NAME,
    teamBName: DEFAULT_TEAM_B_NAME,
  });

  const currentStep = STEPS[stepIndex]!;
  const stepCopy = STEP_COPY[currentStep.id]!;
  const isLastStep = stepIndex === STEPS.length - 1;

  useEffect(() => {
    if (preview) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [preview, stepIndex]);

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function buildPayload(): EventFormInput {
    return {
      ...form,
      ...startFormatValues,
      ...courseSelection,
      ...(form.format === "ryder_cup"
        ? {
            teamAName: form.teamAName,
            teamBName: form.teamBName,
          }
        : {}),
    };
  }

  function validateStep(index: number): string | null {
    const step = STEPS[index];
    if (!step) return "Invalid step.";

    switch (step.id) {
      case "name":
        if (!form.name.trim()) return "Event name is required.";
        return null;
      case "date":
        if (!form.date) return "Event date is required.";
        return null;
      case "format":
        if (!getEventFormat(form.format)) return "Select a valid format.";
        if (form.format === "ryder_cup") {
          if (!form.teamAName.trim()) return "Team A name is required.";
          if (!form.teamBName.trim()) return "Team B name is required.";
        }
        return null;
      case "course":
        if (!courseSelection.courseName.trim()) return "Course name is required.";
        return null;
      case "schedule":
        return validateStartFormatSettings({
          startFormat: startFormatValues.startFormat,
          shotgunStartTime: startFormatValues.shotgunStartTime,
          firstTeeTime: startFormatValues.firstTeeTime,
          teeTimeIntervalMinutes: startFormatValues.teeTimeIntervalMinutes,
        });
      case "registration":
        if (form.maxPlayers < 1 || form.maxPlayers > 500) {
          return "Max players must be between 1 and 500.";
        }
        if (form.entryFeeDollars < 0) return "Entry fee cannot be negative.";
        return null;
      case "review":
        return null;
      default:
        return null;
    }
  }

  function goToStep(index: number) {
    if (index < 0 || index >= STEPS.length) return;
    setError(null);
    setStepIndex(index);
  }

  function handleBack() {
    goToStep(stepIndex - 1);
  }

  function handleContinue() {
    const validationError = validateStep(stepIndex);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (stepIndex === STEPS.length - 1) {
      handleCreate();
      return;
    }

    goToStep(stepIndex + 1);
  }

  function handleCreate() {
    if (preview) return;

    setError(null);
    const payload = buildPayload();

    startTransition(async () => {
      const result = await createEvent(payload);
      if ("success" in result && !result.success) {
        setError(result.error);
      }
    });
  }

  const reviewItems = useMemo(
    () => [
      {
        label: "Event name",
        value: form.name.trim(),
        stepIndex: 0,
      },
      {
        label: "Date",
        value: form.date ? formatEventDate(form.date) : "—",
        stepIndex: 1,
      },
      {
        label: "Format",
        value: getEventFormatLabel(form.format),
        stepIndex: 2,
      },
      {
        label: "Holes",
        value: `${form.holes} holes`,
        stepIndex: 2,
      },
      ...(form.format === "ryder_cup"
        ? [
            { label: "Team A", value: form.teamAName, stepIndex: 2 },
            { label: "Team B", value: form.teamBName, stepIndex: 2 },
          ]
        : []),
      {
        label: "Course",
        value: courseSelection.courseName.trim() || "—",
        stepIndex: 3,
      },
      ...(courseSelection.teeName
        ? [{ label: "Tee", value: courseSelection.teeName, stepIndex: 3 }]
        : []),
      {
        label: "Start",
        value: getStartFormatSummary({
          startFormat: startFormatValues.startFormat,
          shotgunStartTime: startFormatValues.shotgunStartTime,
          firstTeeTime: startFormatValues.firstTeeTime,
          teeTimeIntervalMinutes: startFormatValues.teeTimeIntervalMinutes,
        }),
        stepIndex: 4,
      },
      {
        label: "Max players",
        value: String(form.maxPlayers),
        stepIndex: 5,
      },
      {
        label: "Entry fee",
        value: formatFee(Math.round(form.entryFeeDollars * 100)),
        stepIndex: 5,
      },
      ...(form.description.trim()
        ? [{ label: "Description", value: form.description.trim(), stepIndex: 5 }]
        : []),
    ],
    [courseSelection, form, startFormatValues]
  );

  return (
    <div className="relative min-w-0">
      <div className="space-y-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:space-y-8 sm:pb-0">
        <EventCreationStepper
          steps={STEPS}
          currentStepIndex={stepIndex}
          onStepClick={(index) => {
            if (index < stepIndex) goToStep(index);
          }}
        />

        <div className="space-y-1.5 sm:space-y-2">
          <h2 className="text-lg font-semibold tracking-tight sm:text-2xl">
            {stepCopy.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {stepCopy.description}
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card p-4 sm:p-6">
        {currentStep.id === "name" && (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="wizard-name">Event name</FieldLabel>
              <Input
                id="wizard-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Pine Valley Charity Classic"
                className="h-11 text-base sm:text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleContinue();
                  }
                }}
              />
            </Field>
          </FieldGroup>
        )}

        {currentStep.id === "date" && (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="wizard-date">Event date</FieldLabel>
              <DatePicker
                id="wizard-date"
                value={form.date}
                onChange={(value) => updateField("date", value)}
                placeholder="Select event date"
              />
            </Field>
          </FieldGroup>
        )}

        {currentStep.id === "format" && (
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel>Format</FieldLabel>
                <Select
                  value={form.format}
                  onValueChange={(value) => {
                    if (value) updateField("format", value as EventFormat);
                  }}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="Select format">
                      {getEventFormatLabel(form.format)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_CATEGORIES.map((category) => (
                      <SelectGroup key={category.id}>
                        <SelectLabel>{category.label}</SelectLabel>
                        {EVENT_FORMATS.filter(
                          (format) => format.category === category.id
                        ).map((format) => (
                          <SelectItem key={format.value} value={format.value}>
                            {format.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {getEventFormat(form.format)?.description && (
                  <FieldDescription>
                    {getEventFormat(form.format)!.description}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel>Holes</FieldLabel>
                <Select
                  value={form.holes}
                  onValueChange={(value) => {
                    if (value) updateField("holes", value as EventFormInput["holes"]);
                  }}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="Select holes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18">18 holes</SelectItem>
                    <SelectItem value="9">9 holes</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {form.format === "ryder_cup" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="wizard-team-a">Team A name</FieldLabel>
                  <Input
                    id="wizard-team-a"
                    value={form.teamAName}
                    onChange={(e) => updateField("teamAName", e.target.value)}
                    placeholder="e.g. USA"
                    className="h-11 text-base sm:text-sm"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="wizard-team-b">Team B name</FieldLabel>
                  <Input
                    id="wizard-team-b"
                    value={form.teamBName}
                    onChange={(e) => updateField("teamBName", e.target.value)}
                    placeholder="e.g. Europe"
                    className="h-11 text-base sm:text-sm"
                  />
                </Field>
              </div>
            )}
          </FieldGroup>
        )}

        {currentStep.id === "course" && (
          <FieldGroup>
            <Field>
              <FieldLabel>Course</FieldLabel>
              <CoursePicker
                selection={courseSelection}
                holes={form.holes}
                onChange={setCourseSelection}
              />
            </Field>
          </FieldGroup>
        )}

        {currentStep.id === "schedule" && (
          <StartFormatFields
            values={startFormatValues}
            onChange={setStartFormatValues}
            disabled={isPending}
          />
        )}

        {currentStep.id === "registration" && (
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="wizard-max-players">Max players</FieldLabel>
                <NumericStepperInput
                  id="wizard-max-players"
                  value={form.maxPlayers}
                  onChange={(value) => updateField("maxPlayers", value)}
                  min={1}
                  max={500}
                  step={1}
                  presets={MAX_PLAYERS_PRESETS}
                />
                <FieldDescription>Set capacity for your event field.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="wizard-entry-fee">Entry fee (CAD)</FieldLabel>
                <NumericStepperInput
                  id="wizard-entry-fee"
                  value={form.entryFeeDollars}
                  onChange={(value) => updateField("entryFeeDollars", value)}
                  min={0}
                  max={9999}
                  step={5}
                  prefix="$"
                  inputMode="decimal"
                  formatValue={currencyFormatValue}
                  parseValue={currencyParseValue}
                  presets={ENTRY_FEE_PRESETS}
                />
                <FieldDescription>Use 0 for free events.</FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="wizard-description">
                Description (optional)
              </FieldLabel>
              <Textarea
                id="wizard-description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Tell players what to expect..."
                rows={4}
                className="min-h-24 text-base sm:text-sm"
              />
            </Field>
          </FieldGroup>
        )}

        {currentStep.id === "review" && (
          <div className="space-y-4">
            <dl className="divide-y divide-border rounded-lg border border-border/70">
              {reviewItems.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <dt className="shrink-0 text-sm text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="text-sm font-medium break-words sm:max-w-[60%] sm:text-right">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3.5">
                <Calendar className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{form.name.trim()}</p>
                  <p className="text-xs text-muted-foreground">
                    {form.date ? formatEventDate(form.date) : "Date TBD"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3.5">
                <Flag className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {getEventFormatLabel(form.format)}
                  </p>
                  <p className="text-xs text-muted-foreground">{form.holes} holes</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {courseSelection.courseName.trim() || "Course TBD"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFee(Math.round(form.entryFeeDollars * 100))} ·{" "}
                    {form.maxPlayers} max
                  </p>
                </div>
              </div>
            </div>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Users className="mt-0.5 size-3.5 shrink-0" />
              You can edit all of this while the event is in draft.
            </p>
          </div>
        )}
        </div>

        {error && <FieldError>{error}</FieldError>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.08)] backdrop-blur-lg sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
        <div className="mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            className="order-2 h-11 w-full sm:order-1 sm:w-auto"
            disabled={stepIndex === 0 || isPending}
            onClick={handleBack}
          >
            <ArrowLeft />
            Back
          </Button>

          <Button
            type="button"
            size="lg"
            className="order-1 h-11 w-full sm:order-2 sm:w-auto"
            disabled={isPending}
            onClick={handleContinue}
          >
            {isLastStep ? (
              isPending ? (
                "Creating draft..."
              ) : (
                "Create draft event"
              )
            ) : (
              <>
                Continue
                <ArrowRight />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
