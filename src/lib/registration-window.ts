import { format, isValid, parseISO } from "date-fns";

export type RegistrationWindowFieldValues = {
  opensDate: string;
  opensTime: string;
  closesDate: string;
  closesTime: string;
};

export type RegistrationWindowInput = RegistrationWindowFieldValues;

export function dateTimePartsFromDate(date: Date | null | undefined): {
  date: string;
  time: string;
} {
  if (!date) {
    return { date: "", time: "" };
  }

  return {
    date: format(date, "yyyy-MM-dd"),
    time: format(date, "HH:mm"),
  };
}

export function registrationWindowValuesFromEvent(event?: {
  registrationOpens: Date | null;
  registrationCloses: Date | null;
}): RegistrationWindowFieldValues {
  const opens = dateTimePartsFromDate(event?.registrationOpens);
  const closes = dateTimePartsFromDate(event?.registrationCloses);

  return {
    opensDate: opens.date,
    opensTime: opens.time,
    closesDate: closes.date,
    closesTime: closes.time,
  };
}

export function combineDateAndTime(
  date: string | null | undefined,
  time: string | null | undefined
): Date | null {
  if (!date?.trim()) return null;

  const timePart = time?.trim() || "00:00";
  const parsed = new Date(`${date.trim()}T${timePart}`);

  return isValid(parsed) ? parsed : null;
}

export function formatRegistrationWindow(date: Date | null | undefined): string {
  if (!date) return "Not set";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function parseRegistrationWindowInput(
  input: RegistrationWindowInput
): { opens: Date | null; closes: Date | null } | { error: string } {
  if (input.opensTime?.trim() && !input.opensDate?.trim()) {
    return { error: "Choose a date for when registration opens." };
  }
  if (input.closesTime?.trim() && !input.closesDate?.trim()) {
    return { error: "Choose a date for when registration closes." };
  }

  const opens = combineDateAndTime(input.opensDate, input.opensTime);
  const closes = combineDateAndTime(input.closesDate, input.closesTime);

  if (input.opensDate?.trim() && !opens) {
    return { error: "Registration open date or time is invalid." };
  }
  if (input.closesDate?.trim() && !closes) {
    return { error: "Registration close date or time is invalid." };
  }
  if (opens && closes && closes <= opens) {
    return { error: "Registration must close after it opens." };
  }

  return { opens, closes };
}
