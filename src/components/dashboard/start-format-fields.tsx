"use client";

import {
  DEFAULT_FIRST_TEE_TIME,
  DEFAULT_SHOTGUN_START_TIME,
  DEFAULT_TEE_TIME_INTERVAL_MINUTES,
  START_FORMAT_OPTIONS,
  type StartFormat,
} from "@/lib/start-format";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumericStepperInput } from "@/components/ui/numeric-stepper-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StartFormatFieldValues = {
  startFormat: StartFormat;
  shotgunStartTime: string;
  firstTeeTime: string;
  teeTimeIntervalMinutes: number;
};

type StartFormatFieldsProps = {
  values: StartFormatFieldValues;
  onChange: (values: StartFormatFieldValues) => void;
  disabled?: boolean;
};

export function defaultStartFormatFieldValues(
  event?: {
    startFormat?: StartFormat;
    shotgunStartTime?: string | null;
    firstTeeTime?: string | null;
    teeTimeIntervalMinutes?: number | null;
  } | null
): StartFormatFieldValues {
  return {
    startFormat: event?.startFormat ?? "tee_times",
    shotgunStartTime: event?.shotgunStartTime ?? DEFAULT_SHOTGUN_START_TIME,
    firstTeeTime: event?.firstTeeTime ?? DEFAULT_FIRST_TEE_TIME,
    teeTimeIntervalMinutes:
      event?.teeTimeIntervalMinutes ?? DEFAULT_TEE_TIME_INTERVAL_MINUTES,
  };
}

export function StartFormatFields({
  values,
  onChange,
  disabled,
}: StartFormatFieldsProps) {
  function update<K extends keyof StartFormatFieldValues>(
    key: K,
    value: StartFormatFieldValues[K]
  ) {
    onChange({ ...values, [key]: value });
  }

  const selectedOption = START_FORMAT_OPTIONS.find(
    (option) => option.value === values.startFormat
  );

  return (
    <div className="space-y-5">
      <Field>
        <FieldLabel>Start type</FieldLabel>
        <Select
          value={values.startFormat}
          disabled={disabled}
          onValueChange={(value) => {
            if (value === "shotgun" || value === "tee_times") {
              update("startFormat", value);
            }
          }}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Select start type">
              {selectedOption?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {START_FORMAT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedOption && (
          <FieldDescription>{selectedOption.description}</FieldDescription>
        )}
      </Field>

      {values.startFormat === "shotgun" ? (
        <Field>
          <FieldLabel htmlFor="shotgunStartTime">Shotgun start time</FieldLabel>
          <Input
            id="shotgunStartTime"
            type="time"
            value={values.shotgunStartTime}
            disabled={disabled}
            onChange={(e) => update("shotgunStartTime", e.target.value)}
            className="h-11 text-base sm:text-sm"
            required
          />
          <FieldDescription>
            All groups tee off at this time on their assigned starting holes.
          </FieldDescription>
        </Field>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="firstTeeTime">First tee time</FieldLabel>
            <Input
              id="firstTeeTime"
              type="time"
              value={values.firstTeeTime}
              disabled={disabled}
              onChange={(e) => update("firstTeeTime", e.target.value)}
              className="h-11 text-base sm:text-sm"
              required
            />
            <FieldDescription>When the first group tees off.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="teeTimeIntervalMinutes">
              Minutes between groups
            </FieldLabel>
            <NumericStepperInput
              id="teeTimeIntervalMinutes"
              value={values.teeTimeIntervalMinutes}
              onChange={(value) => update("teeTimeIntervalMinutes", value)}
              min={1}
              max={60}
              step={1}
              disabled={disabled}
              required
            />
            <FieldDescription>
              Tee times are assigned automatically in group order.
            </FieldDescription>
          </Field>
        </div>
      )}
    </div>
  );
}
