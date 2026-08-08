"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2 } from "lucide-react";

import { CombinationTeeIcon } from "@/components/dashboard/combination-tee-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatCombinationTeeName,
  MAX_COMBINATION_BASE_TEES,
  type CourseTeeInput,
} from "@/lib/course-tees";
import { cn } from "@/lib/utils";

export type CombinationTeeLinkPayload = {
  baseTeeKeys: [string, string];
  teeName: string;
};

type CombinationTeeLinkerProps = {
  tees: CourseTeeInput[];
  /** Base tees available to link (non-combination tees). */
  selectableTees: CourseTeeInput[];
  selectedBaseTeeKeys?: string[] | null;
  selectedTeeName?: string | null;
  onConfirm: (payload: CombinationTeeLinkPayload) => void;
  mode?: "create" | "edit";
  disabled?: boolean;
  className?: string;
};

export function CombinationTeeLinker({
  tees,
  selectableTees,
  selectedBaseTeeKeys,
  selectedTeeName,
  onConfirm,
  mode = "create",
  disabled = false,
  className,
}: CombinationTeeLinkerProps) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>(
    () => selectedBaseTeeKeys?.slice(0, MAX_COMBINATION_BASE_TEES) ?? []
  );
  const [teeName, setTeeName] = useState(selectedTeeName ?? "");
  const [teeNameEdited, setTeeNameEdited] = useState(mode === "edit");

  const suggestedName = useMemo(() => {
    if (selection.length < MAX_COMBINATION_BASE_TEES) return "";
    return formatCombinationTeeName(selection, tees);
  }, [selection, tees]);

  const displayName = teeName.trim() || suggestedName;

  useEffect(() => {
    if (!teeNameEdited && suggestedName) {
      setTeeName(suggestedName);
    }
  }, [suggestedName, teeNameEdited]);

  function resetForm() {
    setSelection(
      selectedBaseTeeKeys?.slice(0, MAX_COMBINATION_BASE_TEES) ?? []
    );
    setTeeName(selectedTeeName ?? "");
    setTeeNameEdited(mode === "edit");
  }

  function toggleTee(teeKey: string) {
    setSelection((current) => {
      if (current.includes(teeKey)) {
        return current.filter((key) => key !== teeKey);
      }
      if (current.length >= MAX_COMBINATION_BASE_TEES) {
        return [...current.slice(1), teeKey];
      }
      return [...current, teeKey];
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetForm();
    }
  }

  function handleConfirm() {
    if (selection.length < MAX_COMBINATION_BASE_TEES) return;
    const resolvedName = teeName.trim() || suggestedName;
    if (!resolvedName) return;

    onConfirm({
      baseTeeKeys: [selection[0]!, selection[1]!],
      teeName: resolvedName,
    });
    setOpen(false);
  }

  const canConfirm =
    selection.length === MAX_COMBINATION_BASE_TEES && displayName.length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={
          mode === "edit" ? "Edit combination tees" : "Create combination tee"
        }
        disabled={disabled || selectableTees.length < MAX_COMBINATION_BASE_TEES}
        render={
          <button
            type="button"
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground transition-colors hover:border-solid hover:bg-muted/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
              mode === "edit" &&
                "size-6 rounded-full border-solid border-black/10 bg-background",
              className
            )}
          >
            <Link2 className={mode === "edit" ? "size-3" : "size-3.5"} />
          </button>
        }
      />
      <PopoverContent align="start" className="w-80 p-3">
        <PopoverHeader>
          <PopoverTitle>
            {mode === "edit" ? "Edit combination" : "Combination tee"}
          </PopoverTitle>
          <PopoverDescription>
            Pick two tee rows to combine. Use the scorecard name if it differs
            from the default.
          </PopoverDescription>
        </PopoverHeader>

        {selectableTees.length < MAX_COMBINATION_BASE_TEES ? (
          <p className="text-xs text-muted-foreground">
            Add at least two regular tee rows first.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {selectableTees.map((tee) => {
                const isSelected = selection.includes(tee.teeKey);
                return (
                  <button
                    key={tee.teeKey}
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "bg-background hover:bg-muted/50"
                    )}
                    onClick={() => toggleTee(tee.teeKey)}
                  >
                    {tee.teeColor && (
                      <span
                        className="size-2 shrink-0 rounded-full border border-black/10"
                        style={{ backgroundColor: tee.teeColor }}
                        aria-hidden
                      />
                    )}
                    {tee.teeName}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-muted-foreground">
              {selection.length}/{MAX_COMBINATION_BASE_TEES} selected
            </p>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">
                Name on scorecard
              </span>
              <Input
                value={teeName}
                placeholder={suggestedName || "e.g. Blue/White or Member"}
                className="h-9"
                onChange={(event) => {
                  setTeeNameEdited(true);
                  setTeeName(event.target.value);
                }}
              />
              {suggestedName && teeName.trim() !== suggestedName && (
                <span className="text-[11px] text-muted-foreground">
                  Suggested: {suggestedName}
                </span>
              )}
            </label>

            {displayName && selection.length === MAX_COMBINATION_BASE_TEES && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
                <CombinationTeeIcon
                  teeKey="preview"
                  teeName={displayName}
                  allTees={[
                    ...selectableTees,
                    {
                      teeKey: "preview",
                      teeName: displayName,
                      combinationBaseTeeKeys: selection,
                      sortOrder: 999,
                    },
                  ]}
                  className="size-3.5"
                />
                <span className="font-medium">{displayName}</span>
              </div>
            )}

            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {mode === "edit" ? "Update combination" : "Add combination tee"}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
