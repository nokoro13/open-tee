import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Building2,
  CircleDot,
  Flag,
  GitBranch,
  Home,
  MapPinned,
  ShieldCheck,
  Swords,
  Target,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";

import {
  EVENT_FORMATS,
  FORMAT_CATEGORIES,
  type EventFormat,
} from "@/lib/event-formats";

export const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", label: "Events", icon: Home },
  { href: "/dashboard/courses", label: "Verified courses", icon: MapPinned },
  { href: "/dashboard/settings", label: "Organization", icon: Building2 },
] as const;

export const ADMIN_DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard/admin/courses", label: "Verify courses", icon: ShieldCheck },
] as const;

const CREATE_FORMAT_ICONS: Record<EventFormat, LucideIcon> = {
  scramble: UsersRound,
  best_ball: Target,
  alternate_shot: ArrowLeftRight,
  shamble: CircleDot,
  stroke: Flag,
  stableford: GitBranch,
  match_play: Swords,
  head_to_head: Users,
  ryder_cup: Trophy,
};

export const CREATE_FORMAT_SHORTCUTS = FORMAT_CATEGORIES.flatMap((category) =>
  EVENT_FORMATS.filter((format) => format.category === category.id).map(
    (format) => ({
      format: format.value,
      label: format.label,
      category: category.label,
      href: `/dashboard/events/new?format=${format.value}`,
      icon: CREATE_FORMAT_ICONS[format.value],
    })
  )
);

export function getNewEventHref(format?: EventFormat) {
  return format
    ? `/dashboard/events/new?format=${format}`
    : "/dashboard/events/new";
}
