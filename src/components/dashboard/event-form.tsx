"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createEvent,
  deleteEvent,
  updateEvent,
  type EventFormInput,
} from "@/actions/events";
import {
  CoursePicker,
  type CourseSelection,
} from "@/components/dashboard/course-picker";
import type { Event, EventHole } from "@/db/schema";
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
  DEFAULT_TEAM_A_NAME,
  DEFAULT_TEAM_B_NAME,
  EVENT_FORMATS,
  FORMAT_CATEGORIES,
  getEventFormat,
  getEventFormatLabel,
  type EventFormat,
} from "@/lib/event-formats";

type EventFormProps = {
  event?: Event & { eventHoles?: EventHole[] };
};

const defaultCourseSelection = (): CourseSelection => ({
  courseName: "",
  externalCourseId: null,
  nineSide: null,
  scorecardHoles: [],
});

const defaultValues: Omit<EventFormInput, keyof CourseSelection> & CourseSelection = {
  name: "",
  date: "",
  courseName: "",
  externalCourseId: null,
  nineSide: null,
  scorecardHoles: [],
  format: "scramble",
  holes: "18",
  maxPlayers: 72,
  entryFeeDollars: 0,
  description: "",
  teamAName: DEFAULT_TEAM_A_NAME,
  teamBName: DEFAULT_TEAM_B_NAME,
};

export function EventForm({ event }: EventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [courseSelection, setCourseSelection] = useState<CourseSelection>(() =>
    event
      ? {
          courseName: event.courseName,
          externalCourseId: event.externalCourseId,
          nineSide: event.nineSide,
          scorecardHoles:
            event.eventHoles?.map((hole) => ({
              holeNumber: hole.holeNumber,
              par: hole.par,
              yardage: hole.yardage,
            })) ?? [],
        }
      : defaultCourseSelection()
  );

  const [form, setForm] = useState(() =>
    event
      ? {
          name: event.name,
          date: event.date,
          format: event.format,
          holes: event.holes,
          maxPlayers: event.maxPlayers,
          entryFeeDollars: event.entryFeeCents / 100,
          description: event.description ?? "",
          teamAName: event.teamAName ?? DEFAULT_TEAM_A_NAME,
          teamBName: event.teamBName ?? DEFAULT_TEAM_B_NAME,
        }
      : {
          name: defaultValues.name,
          date: defaultValues.date,
          format: defaultValues.format,
          holes: defaultValues.holes,
          maxPlayers: defaultValues.maxPlayers,
          entryFeeDollars: defaultValues.entryFeeDollars,
          description: defaultValues.description,
          teamAName: defaultValues.teamAName,
          teamBName: defaultValues.teamBName,
        }
  );

  function buildPayload(): EventFormInput {
    return {
      ...form,
      courseName: courseSelection.courseName,
      externalCourseId: courseSelection.externalCourseId,
      nineSide: courseSelection.nineSide,
      scorecardHoles: courseSelection.scorecardHoles,
      ...(form.format === "ryder_cup"
        ? {
            teamAName: form.teamAName,
            teamBName: form.teamBName,
          }
        : {}),
    };
  }

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = buildPayload();

    startTransition(async () => {
      const result = event
        ? await updateEvent(event.id, payload)
        : await createEvent(payload);

      if ("success" in result && !result.success) {
        setError(result.error);
        return;
      }

      if (event) {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!event) return;
    if (!confirm("Delete this draft event? This cannot be undone.")) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if ("success" in result && !result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Event name</FieldLabel>
          <Input
            id="name"
            name="name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Pine Valley Charity Classic"
            className="h-11 text-base sm:text-sm"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="date">Event date</FieldLabel>
          <DatePicker
            id="date"
            name="date"
            value={form.date}
            onChange={(value) => updateField("date", value)}
            placeholder="Select event date"
            required
          />
        </Field>

        <Field>
          <FieldLabel>Course</FieldLabel>
          <CoursePicker
            courseName={courseSelection.courseName}
            externalCourseId={courseSelection.externalCourseId}
            nineSide={courseSelection.nineSide}
            initialScorecard={courseSelection.scorecardHoles}
            holes={form.holes}
            onChange={setCourseSelection}
          />
        </Field>

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
                    {EVENT_FORMATS.filter((f) => f.category === category.id).map(
                      (format) => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
                        </SelectItem>
                      )
                    )}
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
              <FieldLabel htmlFor="teamAName">Team A name</FieldLabel>
              <Input
                id="teamAName"
                value={form.teamAName}
                onChange={(e) => updateField("teamAName", e.target.value)}
                placeholder="e.g. USA"
                className="h-11 text-base sm:text-sm"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="teamBName">Team B name</FieldLabel>
              <Input
                id="teamBName"
                value={form.teamBName}
                onChange={(e) => updateField("teamBName", e.target.value)}
                placeholder="e.g. Europe"
                className="h-11 text-base sm:text-sm"
                required
              />
            </Field>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="maxPlayers">Max players</FieldLabel>
            <NumericStepperInput
              id="maxPlayers"
              name="maxPlayers"
              value={form.maxPlayers}
              onChange={(value) => updateField("maxPlayers", value)}
              min={1}
              max={500}
              step={1}
              presets={MAX_PLAYERS_PRESETS}
              required
            />
            <FieldDescription>Starter plan supports up to 72.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="entryFeeDollars">Entry fee (USD)</FieldLabel>
            <NumericStepperInput
              id="entryFeeDollars"
              name="entryFeeDollars"
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
              required
            />
            <FieldDescription>Use 0 for free events.</FieldDescription>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
          <Textarea
            id="description"
            name="description"
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Tell players what to expect..."
            rows={4}
            className="min-h-24 text-base sm:text-sm"
          />
        </Field>
      </FieldGroup>

      {error && <FieldError>{error}</FieldError>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          size="lg"
          className="h-11 w-full sm:w-auto"
          disabled={isPending}
        >
          {isPending
            ? "Saving..."
            : event
              ? "Save changes"
              : "Create draft event"}
        </Button>

        {event && event.status === "draft" && (
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="h-11 w-full sm:w-auto"
            disabled={isPending}
            onClick={handleDelete}
          >
            Delete draft
          </Button>
        )}
      </div>
    </form>
  );
}
