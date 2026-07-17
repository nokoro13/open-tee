"use client";

import {
  Field,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  regionLabel,
  regionOptions,
  type CourseCountry,
} from "@/lib/course-location";
import { cn } from "@/lib/utils";

const EMPTY_REGION_VALUE = "__none__";

type CourseRegionSelectProps = {
  country: CourseCountry;
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

export function CourseRegionSelect({
  country,
  value,
  onChange,
  id,
}: CourseRegionSelectProps) {
  const options = regionOptions(country);
  const label = regionLabel(country);
  const placeholder = country === "CA" ? "Select province" : "Select state";
  const selectValue = value || EMPTY_REGION_VALUE;
  const selectedLabel = value
    ? options.find((entry) => entry.value === value)?.label
    : null;

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        key={country}
        value={selectValue}
        onValueChange={(next) => {
          if (!next) return;
          onChange(next === EMPTY_REGION_VALUE ? "" : next);
        }}
      >
        <SelectTrigger id={id} className="h-11 w-full">
          <span
            className={cn(
              "flex-1 truncate text-left",
              !selectedLabel && "text-muted-foreground"
            )}
          >
            {selectedLabel ?? placeholder}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_REGION_VALUE} className="text-muted-foreground">
            {placeholder}
          </SelectItem>
          {options.map((entry) => (
            <SelectItem key={entry.value} value={entry.value}>
              {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function clearRegionIfInvalid(
  country: CourseCountry,
  region: string
): string {
  const options = regionOptions(country);
  const upper = region.trim().toUpperCase();
  const match = options.find(
    (entry) =>
      entry.value === upper ||
      entry.label.toLowerCase() === region.trim().toLowerCase()
  );
  return match?.value ?? "";
}
