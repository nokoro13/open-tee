"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type NumericPreset = {
  label: string;
  value: number;
};

type NumericStepperInputProps = {
  id?: string;
  name?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  presets?: NumericPreset[];
  prefix?: string;
  inputMode?: "numeric" | "decimal";
  formatValue?: (value: number) => string;
  parseValue?: (raw: string) => number | null;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function defaultFormat(value: number) {
  return String(value);
}

function defaultParse(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(2);
}

function parseCurrency(raw: string): number | null {
  const trimmed = raw.replace(/^\$/, "").trim();
  if (!trimmed) return null;
  if (!/^\d*(\.\d{0,2})?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function NumericStepperInput({
  id,
  name,
  value,
  onChange,
  min,
  max,
  step = 1,
  presets,
  prefix,
  inputMode = "numeric",
  formatValue = defaultFormat,
  parseValue = defaultParse,
  required,
  disabled,
  className,
}: NumericStepperInputProps) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const displayValue = draft ?? formatValue(value);

  function commitRawInput(raw: string) {
    const parsed = parseValue(raw);
    if (parsed != null) {
      onChange(clamp(parsed, min, max));
    }
    setDraft(null);
  }

  function adjust(delta: number) {
    if (disabled) return;
    onChange(clamp(value + delta, min, max));
    setDraft(null);
  }

  function handlePreset(next: number) {
    if (disabled) return;
    onChange(clamp(next, min, max));
    setDraft(null);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-stretch gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          disabled={disabled || value <= min}
          aria-label="Decrease value"
          onClick={() => adjust(-step)}
        >
          <Minus className="size-4" />
        </Button>

        <div className="relative min-w-0 flex-1">
          {prefix && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-muted-foreground sm:text-sm"
            >
              {prefix}
            </span>
          )}
          <Input
            id={id}
            type="text"
            inputMode={inputMode}
            autoComplete="off"
            disabled={disabled}
            value={displayValue}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setDraft(formatValue(value))}
            onBlur={(e) => commitRawInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRawInput(e.currentTarget.value);
                e.currentTarget.blur();
              }
            }}
            className={cn(
              "h-11 text-center text-base tabular-nums sm:text-sm",
              prefix && "pl-7"
            )}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          disabled={disabled || value >= max}
          aria-label="Increase value"
          onClick={() => adjust(step)}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant={value === preset.value ? "default" : "outline"}
              size="sm"
              className="h-9 min-w-0 flex-1 px-2 sm:flex-none sm:px-3"
              disabled={disabled}
              onClick={() => handlePreset(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      )}

      {required && (
        <input
          type="text"
          name={name}
          value={String(value)}
          required
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={() => {}}
        />
      )}
    </div>
  );
}

export const currencyFormatValue = formatCurrency;
export const currencyParseValue = parseCurrency;

export const MAX_PLAYERS_PRESETS: NumericPreset[] = [
  { label: "36", value: 36 },
  { label: "72", value: 72 },
  { label: "144", value: 144 },
];

export const ENTRY_FEE_PRESETS: NumericPreset[] = [
  { label: "Free", value: 0 },
  { label: "$25", value: 25 },
  { label: "$50", value: 50 },
  { label: "$100", value: 100 },
];
