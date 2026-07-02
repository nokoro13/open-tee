"use client";

import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

function toDateValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function DatePicker({
  value,
  onChange,
  id,
  name,
  placeholder = "Pick a date",
  disabled,
  required,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDateValue(value);
  const today = React.useMemo(() => new Date(), []);
  const startMonth = React.useMemo(
    () => new Date(today.getFullYear(), 0),
    [today]
  );
  const endMonth = React.useMemo(
    () => new Date(today.getFullYear() + 3, 11),
    [today]
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={disabled}
          aria-required={required}
          render={
            <Button
              variant="outline"
              type="button"
              className={cn(
                "h-11 w-full justify-between px-2.5 font-normal text-base sm:text-sm",
                !selected && "text-muted-foreground",
                className
              )}
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarIcon className="size-4 shrink-0" />
            <span className="truncate">
              {selected ? format(selected, "PPP") : placeholder}
            </span>
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent
          className="w-auto max-w-[calc(100vw-2rem)] overflow-hidden p-0"
          align="start"
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? today}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            onSelect={(date) => {
              if (date) {
                onChange(toDateValue(date));
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
      {required && (
        <input
          type="text"
          name={name}
          value={value}
          required
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={() => {}}
        />
      )}
    </>
  );
}
