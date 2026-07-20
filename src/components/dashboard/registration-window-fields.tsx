"use client";

import { useState, useTransition } from "react";

import { updateRegistrationWindow } from "@/actions/events";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  formatRegistrationWindow,
  registrationWindowValuesFromEvent,
  type RegistrationWindowFieldValues,
} from "@/lib/registration-window";

type RegistrationWindowFieldsProps = {
  eventId?: string;
  opensAt: Date | null;
  closesAt: Date | null;
  editable?: boolean;
  onDraftChange?: (values: RegistrationWindowFieldValues) => void;
  draftValues?: RegistrationWindowFieldValues;
};

function DateTimeWindowField({
  label,
  dateId,
  timeId,
  dateValue,
  timeValue,
  datePlaceholder,
  description,
  disabled,
  onDateChange,
  onTimeChange,
}: {
  label: string;
  dateId: string;
  timeId: string;
  dateValue: string;
  timeValue: string;
  datePlaceholder: string;
  description: string;
  disabled?: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <DatePicker
          id={dateId}
          value={dateValue}
          onChange={onDateChange}
          placeholder={datePlaceholder}
          disabled={disabled}
        />
        <Input
          id={timeId}
          type="time"
          value={timeValue}
          onChange={(event) => onTimeChange(event.target.value)}
          className="h-11 text-base sm:text-sm"
          disabled={disabled || !dateValue}
        />
      </div>
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}

export function RegistrationWindowFields({
  eventId,
  opensAt,
  closesAt,
  editable = false,
  onDraftChange,
  draftValues,
}: RegistrationWindowFieldsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [liveValues, setLiveValues] = useState<RegistrationWindowFieldValues>(() =>
    registrationWindowValuesFromEvent({ registrationOpens: opensAt, registrationCloses: closesAt })
  );

  const values = draftValues ?? liveValues;

  function updateValue<K extends keyof RegistrationWindowFieldValues>(
    key: K,
    value: RegistrationWindowFieldValues[K]
  ) {
    const next = { ...values, [key]: value };

    if (key.endsWith("Date") && !value) {
      const timeKey = key.replace("Date", "Time") as keyof RegistrationWindowFieldValues;
      next[timeKey] = "" as RegistrationWindowFieldValues[typeof timeKey];
    }

    if (onDraftChange) {
      onDraftChange(next);
      return;
    }

    setLiveValues(next);
    setSaved(false);
  }

  function handleSave() {
    if (!eventId) return;
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateRegistrationWindow(eventId, values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  if (!editable && !onDraftChange) {
    return (
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Opens</dt>
          <dd className="font-medium">{formatRegistrationWindow(opensAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Closes</dt>
          <dd className="font-medium">{formatRegistrationWindow(closesAt)}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className="space-y-4">
      <FieldGroup className="grid gap-5 lg:grid-cols-2">
        <DateTimeWindowField
          label="Registration opens"
          dateId="registrationOpensDate"
          timeId="registrationOpensTime"
          dateValue={values.opensDate}
          timeValue={values.opensTime}
          datePlaceholder="Select open date"
          description="Leave blank to open immediately when the event is published."
          disabled={isPending}
          onDateChange={(value) => updateValue("opensDate", value)}
          onTimeChange={(value) => updateValue("opensTime", value)}
        />
        <DateTimeWindowField
          label="Registration closes"
          dateId="registrationClosesDate"
          timeId="registrationClosesTime"
          dateValue={values.closesDate}
          timeValue={values.closesTime}
          datePlaceholder="Select close date"
          description="Leave blank to stay open until you close registration or open scoring."
          disabled={isPending}
          onDateChange={(value) => updateValue("closesDate", value)}
          onTimeChange={(value) => updateValue("closesTime", value)}
        />
      </FieldGroup>

      {error && <FieldError>{error}</FieldError>}

      {eventId && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={isPending}
            onClick={handleSave}
          >
            {isPending ? "Saving..." : "Save registration window"}
          </Button>
          {saved && (
            <p className="text-sm text-muted-foreground">Registration window updated.</p>
          )}
        </div>
      )}
    </div>
  );
}

export const draftRegistrationWindowValues = registrationWindowValuesFromEvent;
