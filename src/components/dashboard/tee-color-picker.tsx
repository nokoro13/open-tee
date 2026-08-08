"use client";

import { TEE_COLOR_SWATCHES } from "@/lib/course-tees";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type TeeColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  swatchClassName?: string;
};

export function TeeColorPicker({
  value,
  onChange,
  className,
  swatchClassName = "size-5",
}: TeeColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Pick tee color"
        render={
          <button
            type="button"
            className={cn(
              "shrink-0 rounded-full border border-black/15 shadow-sm transition-transform hover:scale-105",
              swatchClassName,
              className
            )}
            style={{ backgroundColor: value }}
          />
        }
      />
      <PopoverContent align="start" className="w-auto p-2.5">
        <div className="grid grid-cols-5 gap-1.5">
          {TEE_COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.color}
              type="button"
              className={cn(
                "size-6 rounded-full border border-black/10 transition-transform hover:scale-110",
                value.toLowerCase() === swatch.color.toLowerCase() &&
                  "ring-2 ring-primary ring-offset-1"
              )}
              style={{ backgroundColor: swatch.color }}
              aria-label={swatch.name}
              onClick={() => onChange(swatch.color)}
            />
          ))}
        </div>
        <label className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          Custom
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
          />
        </label>
      </PopoverContent>
    </Popover>
  );
}
