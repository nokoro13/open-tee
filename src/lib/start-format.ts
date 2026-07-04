export type StartFormat = "shotgun" | "tee_times";

export const START_FORMAT_OPTIONS: {
  value: StartFormat;
  label: string;
  description: string;
}[] = [
  {
    value: "tee_times",
    label: "Tee times",
    description: "Groups start from the first tee on a staggered schedule.",
  },
  {
    value: "shotgun",
    label: "Shotgun start",
    description: "All groups begin at the same time on different holes.",
  },
];

export const DEFAULT_FIRST_TEE_TIME = "08:00";
export const DEFAULT_SHOTGUN_START_TIME = "08:00";
export const DEFAULT_TEE_TIME_INTERVAL_MINUTES = 10;

export type StartFormatSettings = {
  startFormat: StartFormat;
  shotgunStartTime: string | null;
  firstTeeTime: string | null;
  teeTimeIntervalMinutes: number | null;
};

export function parseTimeToMinutes(time: string): number | null {
  const trimmed = time.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatTimeDisplay(time: string | null | undefined): string {
  if (!time) return "—";
  const minutes = parseTimeToMinutes(time);
  if (minutes == null) return time;

  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
}

export function computeTeeTimeForGroup(
  firstTeeTime: string,
  intervalMinutes: number,
  groupIndex: number
): string {
  const start = parseTimeToMinutes(firstTeeTime);
  if (start == null) return firstTeeTime;
  return formatMinutesToTime(start + groupIndex * intervalMinutes);
}

export function getStartingHoleOptions(holes: "9" | "18"): number[] {
  const count = holes === "9" ? 9 : 18;
  return Array.from({ length: count }, (_, index) => index + 1);
}

export function autoAssignStartingHoles(
  groupCount: number,
  holes: "9" | "18"
): number[] {
  const holeCount = holes === "9" ? 9 : 18;
  if (groupCount <= 0) return [];

  return Array.from({ length: groupCount }, (_, index) => (index % holeCount) + 1);
}

export function validateStartFormatSettings(
  settings: StartFormatSettings
): string | null {
  if (settings.startFormat === "shotgun") {
    if (!settings.shotgunStartTime?.trim()) {
      return "Shotgun start time is required.";
    }
    if (parseTimeToMinutes(settings.shotgunStartTime) == null) {
      return "Enter a valid shotgun start time.";
    }
    return null;
  }

  if (!settings.firstTeeTime?.trim()) {
    return "First tee time is required.";
  }
  if (parseTimeToMinutes(settings.firstTeeTime) == null) {
    return "Enter a valid first tee time.";
  }

  const interval = settings.teeTimeIntervalMinutes;
  if (interval == null || interval < 1 || interval > 60) {
    return "Tee time interval must be between 1 and 60 minutes.";
  }

  return null;
}

export function getStartFormatSummary(
  settings: StartFormatSettings
): string {
  if (settings.startFormat === "shotgun") {
    return `Shotgun · ${formatTimeDisplay(settings.shotgunStartTime)}`;
  }

  return `Tee times · first off ${formatTimeDisplay(settings.firstTeeTime)} every ${settings.teeTimeIntervalMinutes ?? DEFAULT_TEE_TIME_INTERVAL_MINUTES} min`;
}
