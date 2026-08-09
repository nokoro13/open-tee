"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Ellipsis,
  Flag,
  GripVertical,
  Plus,
  Printer,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  assignRegistrationTeamSide,
  assignRegistrationToGroup,
  createPairingGroup,
  deletePairingGroup,
  updatePairingGroup,
} from "@/actions/pairings";
import { updateEventTeamSize } from "@/actions/events";
import { autoAssignShotgunHoles } from "@/actions/start-format";
import { CopyRegistrationLink } from "@/components/dashboard/copy-registration-link";
import { SendScoringLinkButton } from "@/components/dashboard/send-scoring-link-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_PAIR_A_LABEL,
  DEFAULT_PAIR_B_LABEL,
  DEFAULT_TEAM_A_NAME,
  DEFAULT_TEAM_B_NAME,
  RYDER_MATCH_TYPES,
  getEffectiveTeamSize,
  getEventFormat,
  getGroupSizeWarning,
  getMaxGroupPlayers,
  getRyderMatchType,
  getTeamGroupLayout,
  getTeamSizeLabel,
  isTeamFormat,
  reorganizeGroupForTeamSize,
  requiresMatchType,
  requiresTeamSides,
  suggestTeamSide,
  TEAM_SIZE_OPTIONS,
  usesPairSides,
  type TeamGroupLayout,
  type TeamSizeOption,
} from "@/lib/event-formats";
import { isEventSetupLocked } from "@/lib/event-setup-lock";
import type { EventPairings } from "@/lib/pairings";
import { getGroupScorePageUrl } from "@/lib/scoring-code-storage";
import {
  formatTimeDisplay,
  getStartingHoleOptions,
  getStartFormatSummary,
  type StartFormat,
} from "@/lib/start-format";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const UNASSIGNED_DROP_ID = "unassigned";

type PairingPlayer = {
  id: string;
  name: string;
  email: string;
  handicap: string | null;
  paymentStatus: string;
  teamSide: string | null;
  scoringCode?: string | null;
};

type PairingGroup = EventPairings["groups"][number];

type DragPlayerData = {
  registrationId: string;
  fromGroupId: string | null;
  fromTeamSide?: "a" | "b" | null;
};

type DropTarget = {
  groupId: string | null;
  teamSide?: "a" | "b";
};

function parseDropTarget(overId: string): DropTarget | null {
  if (overId === UNASSIGNED_DROP_ID) {
    return { groupId: null };
  }

  if (!overId.startsWith("group:")) {
    return null;
  }

  const rest = overId.slice("group:".length);
  const separator = rest.lastIndexOf(":");
  if (separator === -1) {
    return { groupId: rest };
  }

  const groupId = rest.slice(0, separator);
  const suffix = rest.slice(separator + 1);
  if (suffix === "a" || suffix === "b") {
    return { groupId, teamSide: suffix };
  }
  // Whole-group team zone (teams of 3/4) — avoid colliding with the
  // disabled outer group droppable id (`group:${id}`).
  if (suffix === "team") {
    return { groupId };
  }

  return { groupId: rest };
}

function canAssignToGroup(
  pairings: EventPairings,
  registrationId: string,
  targetGroupId: string | null,
  targetTeamSide: "a" | "b" | undefined,
  format: string,
  teamLayout: TeamGroupLayout | null,
  effectiveTeamSize: number | null,
  pairSides: boolean
): boolean {
  if (targetGroupId === null) return true;

  const found = findPlayer(pairings, registrationId);
  if (!found) return false;

  const fromTeamSide =
    found.player.teamSide === "a" || found.player.teamSide === "b"
      ? found.player.teamSide
      : null;

  if (targetGroupId === found.fromGroupId) {
    if (pairSides) {
      if (!targetTeamSide || targetTeamSide === fromTeamSide) return false;
    } else {
      return false;
    }
  }

  if (pairSides && targetTeamSide) {
    const targetGroup = pairings.groups.find(
      (group) => group.id === targetGroupId
    );
    const pairCount =
      targetGroup?.players.filter(
        (player) =>
          player.teamSide === targetTeamSide && player.id !== registrationId
      ).length ?? 0;
    if (pairCount >= 2) return false;
  }

  if (teamLayout === "single" && effectiveTeamSize) {
    const targetGroup = pairings.groups.find(
      (group) => group.id === targetGroupId
    );
    const teamCount =
      targetGroup?.players.filter((player) => player.id !== registrationId)
        .length ?? 0;
    if (teamCount >= effectiveTeamSize) return false;
  }

  return true;
}

function getAvailableTeamSides(
  pairings: EventPairings,
  registrationId: string,
  groupId: string,
  format: string,
  teamLayout: TeamGroupLayout | null,
  effectiveTeamSize: number | null,
  pairSides: boolean
): ("a" | "b")[] {
  return (["a", "b"] as const).filter((side) =>
    canAssignToGroup(
      pairings,
      registrationId,
      groupId,
      side,
      format,
      teamLayout,
      effectiveTeamSize,
      pairSides
    )
  );
}

type GroupUpdateInput = {
  label?: string;
  teeTime?: string | null;
  startingHole?: number | null;
  matchType?: "singles" | "fourball" | "foursomes" | null;
};

type PairingsBuilderProps = {
  eventId: string;
  slug: string;
  appUrl: string;
  scoringStatus: "disabled" | "open" | "finalized";
  startFormat: StartFormat;
  shotgunStartTime: string | null;
  firstTeeTime: string | null;
  teeTimeIntervalMinutes: number | null;
  holes: "9" | "18";
  format: string;
  teamSize?: number | null;
  teamAName?: string | null;
  teamBName?: string | null;
  pairings: EventPairings;
};

function getGroupCapacity(
  format: string,
  matchType: string | null,
  teamSize: number | null
): { target: number; max: number } {
  if (format === "ryder_cup") {
    const type = getRyderMatchType(matchType);
    if (type) {
      return { target: type.maxPerSide * 2, max: type.maxPerSide * 2 };
    }
    return { target: 4, max: 4 };
  }

  const effectiveTeamSize = getEffectiveTeamSize(format, teamSize);
  if (effectiveTeamSize != null) {
    const max = getMaxGroupPlayers(format, effectiveTeamSize);
    return { target: max, max };
  }

  const meta = getEventFormat(format);
  const max = meta?.maxGroupSize ?? 4;
  const preferred =
    meta && "preferredGroupSize" in meta && meta.preferredGroupSize
      ? meta.preferredGroupSize
      : (meta?.defaultGroupSize ?? max);

  return { target: Math.min(preferred, max), max };
}

export function PairingsBuilder(props: PairingsBuilderProps) {
  const router = useRouter();
  const {
    eventId,
    slug,
    appUrl,
    scoringStatus,
    startFormat,
    shotgunStartTime,
    firstTeeTime,
    teeTimeIntervalMinutes,
    holes,
    format,
    teamSize = null,
    teamAName,
    teamBName,
    pairings,
  } = props;

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [localPairings, setLocalPairings] = useState(pairings);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [detailsGroupId, setDetailsGroupId] = useState<string | null>(null);
  const [localTeamSize, setLocalTeamSize] = useState<number | null>(
    teamSize ?? null
  );
  const isMobile = useIsMobile();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerPicker, setPlayerPicker] = useState<{
    open: boolean;
    groupId: string | null;
  }>({ open: false, groupId: null });
  const [teamSidePicker, setTeamSidePicker] = useState<{
    open: boolean;
    playerId: string;
    groupId: string;
  } | null>(null);

  useEffect(() => {
    setLocalPairings(pairings);
  }, [pairings]);

  useEffect(() => {
    setLocalTeamSize(teamSize ?? null);
  }, [teamSize]);

  const effectiveTeamSize = getEffectiveTeamSize(format, localTeamSize);
  const teamLayout = getTeamGroupLayout(format, localTeamSize);
  const pairSides = usesPairSides(format, localTeamSize);
  const sideALabel = pairSides
    ? DEFAULT_PAIR_A_LABEL
    : teamAName?.trim() || DEFAULT_TEAM_A_NAME;
  const sideBLabel = pairSides
    ? DEFAULT_PAIR_B_LABEL
    : teamBName?.trim() || DEFAULT_TEAM_B_NAME;
  const showTeamSides = requiresTeamSides(format, localTeamSize);
  const showMatchType = requiresMatchType(format);
  const setupLocked = isEventSetupLocked(scoringStatus);
  const controlsDisabled = isPending || setupLocked;
  const showScoringLinks = scoringStatus !== "disabled";
  const canEmailPlayers = scoringStatus === "open";
  const startingHoleOptions = getStartingHoleOptions(holes);
  const scheduleSummary = getStartFormatSummary({
    startFormat,
    shotgunStartTime,
    firstTeeTime,
    teeTimeIntervalMinutes,
  });

  const totalAssigned = localPairings.groups.reduce(
    (sum, group) => sum + group.players.length,
    0
  );

  const filteredUnassigned = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return localPairings.unassigned;
    return localPairings.unassigned.filter(
      (player) =>
        player.name.toLowerCase().includes(query) ||
        player.email.toLowerCase().includes(query)
    );
  }, [localPairings.unassigned, search]);

  const activePlayer = useMemo(() => {
    if (!activePlayerId) return null;
    return findPlayer(localPairings, activePlayerId)?.player ?? null;
  }, [activePlayerId, localPairings]);

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return findPlayer(localPairings, selectedPlayerId)?.player ?? null;
  }, [selectedPlayerId, localPairings]);

  const detailsGroup = useMemo(
    () =>
      detailsGroupId
        ? (localPairings.groups.find((group) => group.id === detailsGroupId) ??
          null)
        : null,
    [detailsGroupId, localPairings.groups]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor)
  );

  function runAction<T extends { success: boolean; error?: string }>(
    action: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: () => void
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        setLocalPairings(pairings);
        onError?.();
        return;
      }
      onSuccess?.(result);
    });
  }

  function handleCreateGroup() {
    runAction(
      () => createPairingGroup(eventId),
      (result) => {
        if ("group" in result && result.group) {
          setLocalPairings((current) => ({
            ...current,
            groups: [...current.groups, result.group],
          }));
        }
      }
    );
  }

  function updateGroupLocally(groupId: string, input: GroupUpdateInput) {
    setLocalPairings((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === groupId ? { ...group, ...input } : group
      ),
    }));
  }

  function handleUpdateGroup(groupId: string, input: GroupUpdateInput) {
    updateGroupLocally(groupId, input);
    runAction(() => updatePairingGroup(groupId, input));
  }

  function deleteGroupLocally(groupId: string) {
    setLocalPairings((current) => {
      const group = current.groups.find((entry) => entry.id === groupId);
      if (!group) return current;

      return {
        groups: current.groups.filter((entry) => entry.id !== groupId),
        unassigned: [
          ...current.unassigned,
          ...group.players.map((player) => ({
            ...player,
            scoringCode: null,
          })),
        ].sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
  }

  function handleDeleteGroup(groupId: string) {
    setDetailsGroupId((current) => (current === groupId ? null : current));
    deleteGroupLocally(groupId);
    runAction(() => deletePairingGroup(groupId));
  }

  function handleTeamSide(registrationId: string, teamSide: "a" | "b" | null) {
    setLocalPairings((current) => ({
      groups: current.groups.map((group) => ({
        ...group,
        players: group.players.map((player) =>
          player.id === registrationId ? { ...player, teamSide } : player
        ),
      })),
      unassigned: current.unassigned.map((player) =>
        player.id === registrationId ? { ...player, teamSide } : player
      ),
    }));
    runAction(() => assignRegistrationTeamSide(registrationId, teamSide));
  }

  function autoAssignShotgunHolesLocally() {
    const holeCount = holes === "9" ? 9 : 18;
    setLocalPairings((current) => ({
      ...current,
      groups: current.groups.map((group, index) => ({
        ...group,
        startingHole: (index % holeCount) + 1,
        teeTime: null,
      })),
    }));
  }

  function movePlayerLocally(
    registrationId: string,
    toGroupId: string | null,
    toTeamSide?: "a" | "b"
  ) {
    setLocalPairings((current) => {
      const found = findPlayer(current, registrationId);
      if (!found) return current;

      const player: EventPairings["unassigned"][number] = {
        ...found.player,
        scoringCode:
          "scoringCode" in found.player
            ? (found.player.scoringCode ?? null)
            : null,
      };
      const groups = current.groups.map((group) => ({
        ...group,
        players: group.players.filter((p) => p.id !== registrationId),
      }));

      if (toGroupId) {
        const targetIndex = groups.findIndex((group) => group.id === toGroupId);
        if (targetIndex === -1) return current;
        const targetGroup = groups[targetIndex];
        const assignedPlayer =
          pairSides && toTeamSide
            ? { ...player, teamSide: toTeamSide }
            : pairSides
              ? {
                  ...player,
                  teamSide: suggestTeamSide(targetGroup.players),
                }
              : player;
        groups[targetIndex] = {
          ...targetGroup,
          players: [...targetGroup.players, assignedPlayer].sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
        };
      }

      const unassignedPlayer =
        toGroupId === null && pairSides
          ? { ...player, teamSide: null }
          : player;

      const unassigned =
        toGroupId === null
          ? [
              ...current.unassigned.filter((p) => p.id !== registrationId),
              unassignedPlayer,
            ].sort((a, b) => a.name.localeCompare(b.name))
          : current.unassigned.filter((p) => p.id !== registrationId);

      return { groups, unassigned };
    });
  }

  function handleMovePlayer(
    registrationId: string,
    toGroupId: string | null,
    toTeamSide?: "a" | "b"
  ) {
    movePlayerLocally(registrationId, toGroupId, toTeamSide);
    setSelectedPlayerId((current) =>
      current === registrationId ? null : current
    );
    runAction(
      () => assignRegistrationToGroup(registrationId, toGroupId, toTeamSide),
      () => router.refresh()
    );
  }

  function resolveAssignTeamSide(
    groupId: string,
    explicitSide?: "a" | "b"
  ): "a" | "b" | undefined {
    if (explicitSide) return explicitSide;
    if (!pairSides) return undefined;
    const group = localPairings.groups.find((entry) => entry.id === groupId);
    if (!group) return undefined;
    return suggestTeamSide(group.players);
  }

  function handleAssignToGroup(
    registrationId: string,
    groupId: string,
    teamSide?: "a" | "b"
  ) {
    const resolvedSide = resolveAssignTeamSide(groupId, teamSide);
    if (
      !canAssignToGroup(
        localPairings,
        registrationId,
        groupId,
        resolvedSide,
        format,
        teamLayout,
        effectiveTeamSize,
        pairSides
      )
    ) {
      return;
    }
    handleMovePlayer(registrationId, groupId, resolvedSide);
  }

  function handlePlayerPickerSelect(playerId: string) {
    if (playerPicker.groupId) {
      const groupId = playerPicker.groupId;
      if (teamLayout === "split") {
        const available = getAvailableTeamSides(
          localPairings,
          playerId,
          groupId,
          format,
          teamLayout,
          effectiveTeamSize,
          pairSides
        );
        setPlayerPicker({ open: false, groupId: null });
        if (available.length === 1) {
          handleAssignToGroup(playerId, groupId, available[0]);
        } else if (available.length > 1) {
          setTeamSidePicker({ open: true, playerId, groupId });
        }
        return;
      }
      handleAssignToGroup(playerId, groupId);
      setPlayerPicker({ open: false, groupId: null });
      return;
    }
    setSelectedPlayerId(playerId);
    setPlayerPicker({ open: false, groupId: null });
  }

  function openPlayerPicker(groupId: string | null) {
    setPlayerPicker({ open: true, groupId });
  }

  function handleDragStart(event: DragStartEvent) {
    setActivePlayerId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActivePlayerId(null);

    if (controlsDisabled) return;

    const { active, over } = event;
    if (!over) return;

    const data = active.data.current as DragPlayerData | undefined;
    if (!data) return;

    const overId = String(over.id);
    const target = parseDropTarget(overId);
    if (!target) return;

    const activePlayer = findPlayer(localPairings, data.registrationId)?.player;
    const fromTeamSide =
      activePlayer?.teamSide === "a" || activePlayer?.teamSide === "b"
        ? activePlayer.teamSide
        : null;

    if (target.groupId === data.fromGroupId) {
      if (pairSides) {
        if (!target.teamSide || target.teamSide === fromTeamSide) return;
      } else {
        return;
      }
    }

    if (pairSides && target.groupId && target.teamSide) {
      const targetGroup = localPairings.groups.find(
        (group) => group.id === target.groupId
      );
      const pairCount =
        targetGroup?.players.filter(
          (player) =>
            player.teamSide === target.teamSide &&
            player.id !== data.registrationId
        ).length ?? 0;
      if (pairCount >= 2) return;
    }

    if (teamLayout === "single" && target.groupId && effectiveTeamSize) {
      const targetGroup = localPairings.groups.find(
        (group) => group.id === target.groupId
      );
      const teamCount =
        targetGroup?.players.filter(
          (player) => player.id !== data.registrationId
        ).length ?? 0;
      if (teamCount >= effectiveTeamSize) return;
    }

    handleMovePlayer(data.registrationId, target.groupId, target.teamSide);
  }

  function handleTeamSizeChange(nextSize: TeamSizeOption) {
    const previous = localTeamSize;
    const previousPairings = localPairings;
    setLocalTeamSize(nextSize);
    setLocalPairings((current) => {
      const overflowPlayers: EventPairings["unassigned"] = [];
      const nextGroups = current.groups.map((group) => {
        const { kept, overflow } = reorganizeGroupForTeamSize(
          group.players,
          nextSize
        );
        for (const player of overflow) {
          overflowPlayers.push({
            ...player,
            teamSide: null,
            scoringCode: null,
          });
        }
        return { ...group, players: kept };
      });

      const nextUnassigned = [
        ...current.unassigned.map((player) => ({
          ...player,
          teamSide: null,
        })),
        ...overflowPlayers,
      ].sort((a, b) => a.name.localeCompare(b.name));

      return { groups: nextGroups, unassigned: nextUnassigned };
    });
    runAction(
      () => updateEventTeamSize(eventId, nextSize),
      () => router.refresh(),
      () => {
        setLocalTeamSize(previous);
        setLocalPairings(previousPairings);
      }
    );
  }

  function handleDragCancel() {
    setActivePlayerId(null);
  }

  const pairingHint = isMobile
    ? teamLayout === "split"
      ? `Tap Add player, then choose ${sideALabel} or ${sideBLabel}. Or select a player and tap a team zone.`
      : teamLayout === "single" && effectiveTeamSize
        ? `Tap Add player on a group, or select a player then tap a group.`
        : showMatchType
          ? `Tap Add player on a match to assign sides.`
          : "Tap Add player on a group, or select a player then tap a group."
    : teamLayout === "split"
      ? `Groups tee off together (max 4 players). Assign players to ${sideALabel} or ${sideBLabel}.`
      : teamLayout === "single" && effectiveTeamSize
        ? `Each group holds one team of ${effectiveTeamSize}. Drag players from the sidebar into a team slot.`
        : showMatchType
          ? `Build matches and assign ${sideALabel} / ${sideBLabel} sides for each player.`
          : "Drag registrants from the sidebar into groups.";

  const canPrintScorecards = localPairings.groups.some(
    (group) => group.players.length > 0 && group.scoringCode != null
  );
  const showAutoAssignHoles =
    startFormat === "shotgun" &&
    localPairings.groups.length > 0 &&
    !setupLocked;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="size-4 shrink-0" />
              Pairings
            </CardTitle>
            <p className="max-w-2xl text-pretty text-sm text-muted-foreground">
              {pairingHint}
            </p>
            {scheduleSummary && (
              <p className="text-xs text-muted-foreground">{scheduleSummary}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
            <Badge variant="secondary" className="tabular-nums font-normal">
              {totalAssigned} assigned
            </Badge>
            <Badge variant="outline" className="tabular-nums font-normal">
              {localPairings.unassigned.length} unassigned
            </Badge>
            {localPairings.groups.length > 0 && (
              <Badge variant="outline" className="tabular-nums font-normal">
                {localPairings.groups.length}{" "}
                {showMatchType ? "matches" : "groups"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-4 pb-24 lg:pb-4">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {localPairings.groups.length === 0 &&
        localPairings.unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No registrations yet. Pairings will appear once players sign up.
          </p>
        ) : (
          <DndContext
            id={`pairings-dnd-${eventId}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden lg:min-h-130 lg:flex-row lg:gap-6">
              <div className="order-1 min-w-0 w-full max-w-full flex-1 space-y-0 lg:order-2">
                <div className="mb-3 space-y-1">
                  <h3 className="text-sm font-semibold">
                    {showMatchType ? "Matches" : "Groups"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {localPairings.groups.length} total
                    {localPairings.groups.length > 0
                      ? isMobile
                        ? " · tap Add player or open details"
                        : " · tap a row for details"
                      : ""}
                  </p>
                </div>

                <PairingsGroupsToolbar
                  format={format}
                  effectiveTeamSize={effectiveTeamSize}
                  showMatchType={showMatchType}
                  controlsDisabled={controlsDisabled}
                  setupLocked={setupLocked}
                  showAutoAssignHoles={showAutoAssignHoles}
                  canPrintScorecards={canPrintScorecards}
                  eventId={eventId}
                  isMobile={isMobile}
                  onTeamSizeChange={handleTeamSizeChange}
                  onAutoAssignHoles={() => {
                    autoAssignShotgunHolesLocally();
                    runAction(() => autoAssignShotgunHoles(eventId));
                  }}
                  onCreateGroup={handleCreateGroup}
                />

                {localPairings.groups.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/15 px-6 py-12 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <Users className="size-4 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm font-medium">
                      {showMatchType ? "No matches yet" : "No groups yet"}
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {isMobile ? (
                        <>
                          Tap{" "}
                          <span className="font-medium text-foreground">
                            {showMatchType ? "Add match" : "Add group"}
                          </span>{" "}
                          below, then assign players from the unassigned list.
                        </>
                      ) : (
                        <>
                          Click{" "}
                          <span className="font-medium text-foreground">
                            {showMatchType ? "Add match" : "Add group"}
                          </span>{" "}
                          to create one, then drag players from the sidebar.
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="flex min-w-0 w-full max-w-full flex-col gap-2.5">
                    {localPairings.groups.map((group) => {
                      const teamACount = group.players.filter(
                        (p) => p.teamSide === "a"
                      ).length;
                      const teamBCount = group.players.filter(
                        (p) => p.teamSide === "b"
                      ).length;
                      const warning = getGroupSizeWarning(
                        format,
                        group.players.length,
                        {
                          matchType: group.matchType,
                          teamACount,
                          teamBCount,
                          teamSize: localTeamSize,
                        }
                      );
                      const canAssignToTeamA =
                        selectedPlayerId != null &&
                        canAssignToGroup(
                          localPairings,
                          selectedPlayerId,
                          group.id,
                          "a",
                          format,
                          teamLayout,
                          effectiveTeamSize,
                          pairSides
                        );
                      const canAssignToTeamB =
                        selectedPlayerId != null &&
                        canAssignToGroup(
                          localPairings,
                          selectedPlayerId,
                          group.id,
                          "b",
                          format,
                          teamLayout,
                          effectiveTeamSize,
                          pairSides
                        );
                      const canAssignHere =
                        selectedPlayerId != null &&
                        (teamLayout === "split"
                          ? canAssignToTeamA || canAssignToTeamB
                          : canAssignToGroup(
                              localPairings,
                              selectedPlayerId,
                              group.id,
                              resolveAssignTeamSide(group.id),
                              format,
                              teamLayout,
                              effectiveTeamSize,
                              pairSides
                            ));

                      return (
                        <GroupRow
                          key={group.id}
                          group={group}
                          format={format}
                          teamSize={localTeamSize}
                          teamLayout={teamLayout}
                          effectiveTeamSize={effectiveTeamSize}
                          startFormat={startFormat}
                          startingHoleOptions={startingHoleOptions}
                          showMatchType={showMatchType}
                          showTeamSides={showTeamSides}
                          sideALabel={sideALabel}
                          sideBLabel={sideBLabel}
                          warning={warning}
                          disabled={controlsDisabled}
                          isMobile={isMobile}
                          assignMode={
                            canAssignHere &&
                            !(isMobile && teamLayout === "split")
                          }
                          assignTeamA={canAssignToTeamA}
                          assignTeamB={canAssignToTeamB}
                          selectedPlayerId={selectedPlayerId}
                          onUpdate={(input) =>
                            handleUpdateGroup(group.id, input)
                          }
                          onOpenDetails={() => setDetailsGroupId(group.id)}
                          onAddPlayer={() => openPlayerPicker(group.id)}
                          onAssignHere={() => {
                            if (selectedPlayerId) {
                              handleAssignToGroup(selectedPlayerId, group.id);
                            }
                          }}
                          onAssignToTeam={(teamSide) => {
                            if (selectedPlayerId) {
                              handleAssignToGroup(
                                selectedPlayerId,
                                group.id,
                                teamSide
                              );
                            }
                          }}
                          onSelectPlayer={setSelectedPlayerId}
                          onTeamSide={handleTeamSide}
                          onRemovePlayer={(registrationId) =>
                            handleMovePlayer(registrationId, null)
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              <RegistrantsSidebar
                players={filteredUnassigned}
                totalCount={localPairings.unassigned.length}
                search={search}
                onSearchChange={setSearch}
                disabled={controlsDisabled}
                isMobile={isMobile}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={setSelectedPlayerId}
              />
            </div>

            {isMobile && !setupLocked && (
              <MobileAssignBar
                unassignedCount={localPairings.unassigned.length}
                selectedPlayer={selectedPlayer}
                splitTeams={teamLayout === "split"}
                sideALabel={sideALabel}
                sideBLabel={sideBLabel}
                onOpenPicker={() => openPlayerPicker(null)}
                onClearSelection={() => setSelectedPlayerId(null)}
              />
            )}

            <PlayerPickerSheet
              open={playerPicker.open}
              onOpenChange={(open) => {
                if (!open) setPlayerPicker({ open: false, groupId: null });
              }}
              players={filteredUnassigned}
              search={search}
              onSearchChange={setSearch}
              targetGroup={
                playerPicker.groupId
                  ? (localPairings.groups.find(
                      (group) => group.id === playerPicker.groupId
                    ) ?? null)
                  : null
              }
              showMatchType={showMatchType}
              disabled={controlsDisabled}
              onSelectPlayer={handlePlayerPickerSelect}
            />

            <TeamSidePickerSheet
              open={teamSidePicker?.open ?? false}
              onOpenChange={(open) => {
                if (!open) setTeamSidePicker(null);
              }}
              group={
                teamSidePicker
                  ? (localPairings.groups.find(
                      (entry) => entry.id === teamSidePicker.groupId
                    ) ?? null)
                  : null
              }
              player={
                teamSidePicker
                  ? (findPlayer(localPairings, teamSidePicker.playerId)
                      ?.player ?? null)
                  : null
              }
              sideALabel={sideALabel}
              sideBLabel={sideBLabel}
              availableSides={
                teamSidePicker
                  ? getAvailableTeamSides(
                      localPairings,
                      teamSidePicker.playerId,
                      teamSidePicker.groupId,
                      format,
                      teamLayout,
                      effectiveTeamSize,
                      pairSides
                    )
                  : []
              }
              disabled={controlsDisabled}
              onSelectSide={(teamSide) => {
                if (teamSidePicker) {
                  handleAssignToGroup(
                    teamSidePicker.playerId,
                    teamSidePicker.groupId,
                    teamSide
                  );
                  setTeamSidePicker(null);
                }
              }}
            />

            <DragOverlay dropAnimation={null}>
              {activePlayer ? (
                <div className="touch-none">
                  <PillVisual
                    player={activePlayer}
                    showTeamSides={showTeamSides}
                    className="shadow-md ring-2 ring-primary/30"
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        <GroupDetailsSheet
          group={detailsGroup}
          onOpenChange={(open) => {
            if (!open) setDetailsGroupId(null);
          }}
          eventId={eventId}
          format={format}
          teamSize={localTeamSize}
          startFormat={startFormat}
          startingHoleOptions={startingHoleOptions}
          showMatchType={showMatchType}
          showTeamSides={showTeamSides}
          sideALabel={sideALabel}
          sideBLabel={sideBLabel}
          disabled={controlsDisabled}
          isPending={isPending}
          setupLocked={setupLocked}
          showScoringLinks={showScoringLinks}
          canEmailPlayers={canEmailPlayers}
          appUrl={appUrl}
          slug={slug}
          unassignedCount={localPairings.unassigned.length}
          isMobile={isMobile}
          onAddPlayers={() => {
            if (detailsGroup) {
              openPlayerPicker(detailsGroup.id);
              setDetailsGroupId(null);
            }
          }}
          onUpdate={(input) => {
            if (detailsGroup) handleUpdateGroup(detailsGroup.id, input);
          }}
          onDelete={() => {
            if (detailsGroup) handleDeleteGroup(detailsGroup.id);
          }}
          onTeamSide={handleTeamSide}
          onRemovePlayer={(registrationId) =>
            handleMovePlayer(registrationId, null)
          }
        />
      </CardContent>
    </Card>
  );
}

type PairingsGroupsToolbarProps = {
  format: string;
  effectiveTeamSize: number | null;
  showMatchType: boolean;
  controlsDisabled: boolean;
  setupLocked: boolean;
  showAutoAssignHoles: boolean;
  canPrintScorecards: boolean;
  eventId: string;
  isMobile: boolean;
  onTeamSizeChange: (size: TeamSizeOption) => void;
  onAutoAssignHoles: () => void;
  onCreateGroup: () => void;
};

function PairingsGroupsToolbar({
  format,
  effectiveTeamSize,
  showMatchType,
  controlsDisabled,
  setupLocked,
  showAutoAssignHoles,
  canPrintScorecards,
  eventId,
  isMobile,
  onTeamSizeChange,
  onAutoAssignHoles,
  onCreateGroup,
}: PairingsGroupsToolbarProps) {
  return (
    <div
      className={cn(
        "mb-3 flex gap-2",
        isMobile
          ? "flex-col"
          : "h-10 items-center justify-between"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {isTeamFormat(format) && effectiveTeamSize ? (
          <>
            <span className="hidden shrink-0 text-xs font-medium text-muted-foreground sm:inline">
              Team size
            </span>
            <Select
              value={String(effectiveTeamSize)}
              disabled={controlsDisabled}
              onValueChange={(value) => {
                if (value) {
                  onTeamSizeChange(Number(value) as TeamSizeOption);
                }
              }}
            >
              <SelectTrigger
                className={cn(
                  "h-10 shrink-0",
                  isMobile ? "w-full" : "w-[8.75rem]"
                )}
                aria-label="Players per team"
              >
                <SelectValue>{effectiveTeamSize} per team</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TEAM_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} players per team
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden truncate text-xs text-muted-foreground xl:inline">
              {getTeamSizeLabel(effectiveTeamSize)}
            </span>
          </>
        ) : (
          !isMobile && (
            <span className="truncate text-xs text-muted-foreground">
              {showMatchType
                ? "Add matches and assign sides below."
                : "Add groups and assign players below."}
            </span>
          )
        )}
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center gap-2",
          isMobile && "flex-wrap"
        )}
      >
        {showAutoAssignHoles && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-10", isMobile && "flex-1")}
            disabled={controlsDisabled}
            onClick={onAutoAssignHoles}
          >
            Auto-assign holes
          </Button>
        )}
        {canPrintScorecards && (
          <ButtonLink
            variant="outline"
            size="sm"
            className={cn("h-10", isMobile && "flex-1")}
            href={`/print/events/${eventId}/scorecards`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Printer />
            <span className="hidden sm:inline">Print scorecards</span>
            <span className="sm:hidden">Print</span>
          </ButtonLink>
        )}
        {!setupLocked && (
          <Button
            type="button"
            size="sm"
            className={cn("h-10", isMobile && "w-full")}
            disabled={controlsDisabled}
            onClick={onCreateGroup}
          >
            <Plus />
            {showMatchType ? "Add match" : "Add group"}
          </Button>
        )}
      </div>
    </div>
  );
}

type RegistrantsSidebarProps = {
  players: PairingPlayer[];
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  disabled: boolean;
  isMobile: boolean;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
};

function RegistrantsSidebar({
  players,
  totalCount,
  search,
  onSearchChange,
  disabled,
  isMobile,
  selectedPlayerId,
  onSelectPlayer,
}: RegistrantsSidebarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(totalCount > 0);

  useEffect(() => {
    if (totalCount > 0) {
      setMobileExpanded(true);
    }
  }, [totalCount]);

  const { isOver, setNodeRef } = useDroppable({
    id: UNASSIGNED_DROP_ID,
    disabled,
  });

  if (isMobile) {
    return null;
  }

  return (
    <aside className="order-2 flex w-full min-w-0 shrink-0 flex-col overflow-x-hidden lg:order-1 lg:w-64 xl:w-72">
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col rounded-xl transition-colors lg:rounded-none",
          isOver && "ring-2 ring-primary/20 lg:ring-0"
        )}
      >
        <button
          type="button"
          className={cn(
            "mb-3 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left lg:hidden",
            isOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"
          )}
          aria-expanded={mobileExpanded}
          onClick={() => setMobileExpanded((open) => !open)}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold">Registrants</p>
            <p className="text-xs text-muted-foreground">
              {totalCount === 0
                ? "All players assigned · drop here to unassign"
                : `${totalCount} unassigned · hold & drag to assign`}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              mobileExpanded && "rotate-180"
            )}
          />
        </button>

        <div className="mb-3 hidden space-y-1 lg:block">
          <h3 className="text-sm font-semibold">Registrants</h3>
          <p className="text-xs text-muted-foreground">
            {totalCount} unassigned · drag into a group
          </p>
        </div>

        <div
          className={cn("flex flex-col", !mobileExpanded && "hidden lg:flex")}
        >
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search name or email"
              className="h-10 pl-9"
              aria-label="Search registrants"
            />
          </div>

          <div
            className={cn(
              "flex flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto rounded-xl border bg-muted/10 p-2 lg:max-h-[calc(100vh-18rem)]",
              isOver && "border-primary bg-primary/5",
              !isOver && "border-border"
            )}
          >
            {totalCount === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground sm:py-8">
                All players are assigned.
              </p>
            ) : players.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground sm:py-8">
                No registrants match your search.
              </p>
            ) : (
              players.map((player) => (
                <SidebarPlayerCard
                  key={player.id}
                  player={player}
                  disabled={disabled}
                  isMobile={false}
                  isSelected={selectedPlayerId === player.id}
                  onSelect={() =>
                    onSelectPlayer(
                      selectedPlayerId === player.id ? null : player.id
                    )
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

type SidebarPlayerCardProps = {
  player: PairingPlayer;
  disabled: boolean;
  isMobile: boolean;
  isSelected: boolean;
  onSelect: () => void;
};

function SidebarPlayerCard({
  player,
  disabled,
  isMobile,
  isSelected,
  onSelect,
}: SidebarPlayerCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    disabled: disabled || isMobile,
    data: {
      registrationId: player.id,
      fromGroupId: null,
    } satisfies DragPlayerData,
  });

  return (
    <div
      ref={setNodeRef}
      {...(!isMobile ? attributes : {})}
      {...(!isMobile ? listeners : {})}
      onClick={isMobile ? onSelect : undefined}
      className={cn(
        "flex select-none items-center gap-2 rounded-lg border bg-background px-2.5 py-2 shadow-xs",
        isMobile ? "min-h-11 touch-manipulation py-2.5" : "touch-none",
        isMobile ? "cursor-pointer" : "border-border",
        !isMobile &&
          (disabled
            ? "cursor-not-allowed opacity-70"
            : "cursor-grab border-border active:cursor-grabbing"),
        isSelected && "border-primary bg-primary/5 ring-2 ring-primary/20",
        !isSelected && isMobile && "border-border",
        isDragging && "opacity-40"
      )}
      aria-label={
        isMobile ? `Select ${player.name} to assign` : `Drag ${player.name}`
      }
      aria-pressed={isMobile ? isSelected : undefined}
    >
      {!isMobile && (
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground/70" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{player.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {player.email}
        </p>
      </div>
      {player.handicap && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {player.handicap}
        </span>
      )}
      <PaymentDot status={player.paymentStatus} />
    </div>
  );
}

function PaymentDot({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span
        className="size-2 shrink-0 rounded-full bg-amber-500"
        title="Payment pending"
      />
    );
  }

  if (status === "refunded") {
    return (
      <span
        className="size-2 shrink-0 rounded-full bg-destructive"
        title="Refunded"
      />
    );
  }

  return null;
}

type GroupRowProps = {
  group: PairingGroup;
  format: string;
  teamSize: number | null;
  teamLayout: TeamGroupLayout | null;
  effectiveTeamSize: number | null;
  startFormat: StartFormat;
  startingHoleOptions: number[];
  showMatchType: boolean;
  showTeamSides: boolean;
  sideALabel: string;
  sideBLabel: string;
  warning: string | null;
  disabled: boolean;
  isMobile: boolean;
  assignMode: boolean;
  assignTeamA: boolean;
  assignTeamB: boolean;
  selectedPlayerId: string | null;
  onUpdate: (input: GroupUpdateInput) => void;
  onOpenDetails: () => void;
  onAddPlayer: () => void;
  onAssignHere: () => void;
  onAssignToTeam: (teamSide: "a" | "b") => void;
  onSelectPlayer: (playerId: string | null) => void;
  onTeamSide: (registrationId: string, teamSide: "a" | "b" | null) => void;
  onRemovePlayer: (registrationId: string) => void;
};

function GroupRow({
  group,
  format,
  teamSize,
  teamLayout,
  effectiveTeamSize,
  startFormat,
  startingHoleOptions,
  showMatchType,
  showTeamSides,
  sideALabel,
  sideBLabel,
  warning,
  disabled,
  isMobile,
  assignMode,
  assignTeamA,
  assignTeamB,
  selectedPlayerId,
  onUpdate,
  onOpenDetails,
  onAddPlayer,
  onAssignHere,
  onAssignToTeam,
  onSelectPlayer,
  onTeamSide,
  onRemovePlayer,
}: GroupRowProps) {
  const useTeamZones = teamLayout != null;
  const dropId = `group:${group.id}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    disabled: disabled || useTeamZones || (isMobile && !assignMode),
  });

  const capacity = getGroupCapacity(format, group.matchType, teamSize);
  const openSlots = Math.max(capacity.target - group.players.length, 0);
  const overCapacity = group.players.length > capacity.max;
  const isFull = group.players.length >= capacity.target && openSlots === 0;
  const teamAPlayers = group.players.filter((player) => player.teamSide === "a");
  const teamBPlayers = group.players.filter((player) => player.teamSide === "b");
  const unassignedPlayers = teamLayout === "split"
    ? group.players.filter(
        (player) => player.teamSide !== "a" && player.teamSide !== "b"
      )
    : [];

  function handleRowClick() {
    if (assignMode) {
      onAssignHere();
      return;
    }
    if (isMobile) {
      onOpenDetails();
    }
  }

  return (
    <div
      ref={useTeamZones ? undefined : setNodeRef}
      role={isMobile || assignMode ? "button" : undefined}
      tabIndex={isMobile || assignMode ? 0 : undefined}
      onClick={isMobile || assignMode ? handleRowClick : undefined}
      onKeyDown={
        isMobile || assignMode
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleRowClick();
              }
            }
          : undefined
      }
      className={cn(
        "min-w-0 rounded-xl border bg-card transition-colors",
        isMobile
          ? "flex flex-col gap-3 px-3 py-3 touch-manipulation"
          : "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-3.5 sm:py-3",
        assignMode
          ? "cursor-pointer border-primary bg-primary/5 ring-2 ring-primary/25"
          : isMobile
            ? "cursor-pointer active:bg-muted/40"
            : !useTeamZones && isOver
              ? "border-primary bg-primary/5 ring-2 ring-inset ring-primary/20"
              : "border-border",
        isFull && !assignMode && "bg-muted/15"
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          isMobile ? "justify-between" : "max-w-40 shrink-0 sm:max-w-48"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {startFormat === "shotgun" ? (
            <Select
              value={group.startingHole != null ? String(group.startingHole) : ""}
              disabled={disabled}
              onValueChange={(value) => {
                if (!value) return;
                onUpdate({ startingHole: Number(value) });
              }}
            >
              <SelectTrigger
                className="h-9 w-22 shrink-0 px-2.5 text-xs sm:h-8 sm:w-24"
                aria-label={`Starting hole for ${group.label}`}
                onClick={(event) => event.stopPropagation()}
              >
                <Flag className="size-3.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Hole">
                  {group.startingHole != null
                    ? `H${group.startingHole}`
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {startingHoleOptions.map((hole) => (
                  <SelectItem key={hole} value={String(hole)}>
                    Hole {hole}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 text-xs font-medium tabular-nums sm:h-8">
              <Clock className="size-3.5 text-muted-foreground" />
              {formatTimeDisplay(group.teeTime)}
            </span>
          )}

          <button
            type="button"
            className="min-w-0 truncate text-left text-sm font-semibold hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetails();
            }}
            title={group.label}
          >
            {group.label}
          </button>

          {showMatchType && (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-[10px]",
                !isMobile && "hidden sm:inline-flex",
                !group.matchType && "border-amber-500/50 text-amber-600"
              )}
            >
              {getRyderMatchType(group.matchType)?.label ?? "No type"}
            </Badge>
          )}
        </div>

        {isMobile && (
          <div className="flex shrink-0 items-center gap-0.5">
            {warning && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="rounded-md p-1 text-amber-600 hover:bg-amber-500/10"
                      aria-label={`Warning: ${warning}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenDetails();
                      }}
                    />
                  }
                >
                  <AlertTriangle className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>{warning}</TooltipContent>
              </Tooltip>
            )}
            <span
              className={cn(
                "px-1 text-xs tabular-nums text-muted-foreground",
                isFull && "font-medium text-foreground/70",
                overCapacity && "font-semibold text-amber-600"
              )}
            >
              {group.players.length}/{capacity.max}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-9"
              aria-label={`Open details for ${group.label}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetails();
              }}
            >
              <Ellipsis className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {assignMode && (
        <p className="text-xs font-medium text-primary">
          Tap to assign here
        </p>
      )}

      <div
        className={cn(
          "min-w-0",
          isMobile ? "w-full" : undefined,
          useTeamZones
            ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
            : "flex flex-wrap items-center gap-1.5",
          !useTeamZones && group.players.length === 0 && "justify-start"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {teamLayout === "split" ? (
          <>
            <TeamDropZone
              groupId={group.id}
              zone="a"
              label={sideALabel}
              capacity={2}
              players={teamAPlayers}
              disabled={disabled}
              isMobile={isMobile}
              assignMode={isMobile && assignTeamA}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={onSelectPlayer}
              onAssignHere={() => onAssignToTeam("a")}
              onRemovePlayer={onRemovePlayer}
            />
            <TeamDropZone
              groupId={group.id}
              zone="b"
              label={sideBLabel}
              capacity={2}
              players={teamBPlayers}
              disabled={disabled}
              isMobile={isMobile}
              assignMode={isMobile && assignTeamB}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={onSelectPlayer}
              onAssignHere={() => onAssignToTeam("b")}
              onRemovePlayer={onRemovePlayer}
            />
            {unassignedPlayers.length > 0 && (
              <div className="col-span-full space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Needs a team — {isMobile ? "assign side in details" : `drag into ${sideALabel} or ${sideBLabel}`}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unassignedPlayers.map((player) => (
                    <GroupPlayerPill
                      key={player.id}
                      player={player}
                      groupId={group.id}
                      disabled={disabled}
                      isMobile={isMobile}
                      isSelected={selectedPlayerId === player.id}
                      showTeamSides={false}
                      sideALabel={sideALabel}
                      sideBLabel={sideBLabel}
                      onTeamSide={() => {}}
                      onSelect={() =>
                        onSelectPlayer(
                          selectedPlayerId === player.id ? null : player.id
                        )
                      }
                      onRemove={() => onRemovePlayer(player.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : teamLayout === "single" && effectiveTeamSize ? (
          <TeamDropZone
            groupId={group.id}
            zone="team"
            label="Team"
            capacity={effectiveTeamSize}
            players={group.players}
            disabled={disabled}
            isMobile={isMobile}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={onSelectPlayer}
            onRemovePlayer={onRemovePlayer}
            className="sm:col-span-2"
          />
        ) : group.players.length === 0 ? (
          <span className="truncate text-xs text-muted-foreground/70">
            {isMobile ? "No players yet" : "Drop players here"}
          </span>
        ) : (
          group.players.map((player) => (
            <GroupPlayerPill
              key={player.id}
              player={player}
              groupId={group.id}
              disabled={disabled}
              isMobile={isMobile}
              isSelected={selectedPlayerId === player.id}
              showTeamSides={showTeamSides}
              sideALabel={sideALabel}
              sideBLabel={sideBLabel}
              onTeamSide={onTeamSide}
              onSelect={() =>
                onSelectPlayer(
                  selectedPlayerId === player.id ? null : player.id
                )
              }
              onRemove={() => onRemovePlayer(player.id)}
            />
          ))
        )}
        {!useTeamZones &&
          openSlots > 0 &&
          Array.from({ length: isMobile ? 1 : openSlots }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "inline-flex h-8 min-w-14 flex-1 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground/45",
                !isMobile && index > 0 && "hidden sm:inline-flex"
              )}
            >
              Open
            </span>
          ))}
      </div>

      {isMobile && !disabled && !isFull && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full touch-manipulation"
          onClick={(event) => {
            event.stopPropagation();
            onAddPlayer();
          }}
        >
          <UserPlus />
          Add player
        </Button>
      )}

      {!isMobile && (
        <div className="flex shrink-0 items-center gap-0.5">
          {warning && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="rounded-md p-1 text-amber-600 hover:bg-amber-500/10"
                    aria-label={`Warning: ${warning}`}
                    onClick={onOpenDetails}
                  />
                }
              >
                <AlertTriangle className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{warning}</TooltipContent>
            </Tooltip>
          )}
          <span
            className={cn(
              "px-1 text-xs tabular-nums text-muted-foreground",
              isFull && "font-medium text-foreground/70",
              overCapacity && "font-semibold text-amber-600"
            )}
          >
            {group.players.length}/{capacity.max}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            aria-label={`Open details for ${group.label}`}
            onClick={onOpenDetails}
          >
            <Ellipsis className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

type TeamDropZoneProps = {
  groupId: string;
  /** Drop-target zone: a/b for split teams, team for one team per group. */
  zone: "a" | "b" | "team";
  label: string;
  capacity: number;
  players: PairingPlayer[];
  disabled: boolean;
  isMobile: boolean;
  assignMode?: boolean;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
  onAssignHere?: () => void;
  onRemovePlayer: (registrationId: string) => void;
  className?: string;
};

function TeamDropZone({
  groupId,
  zone,
  label,
  capacity,
  players,
  disabled,
  isMobile,
  assignMode = false,
  selectedPlayerId,
  onSelectPlayer,
  onAssignHere,
  onRemovePlayer,
  className,
}: TeamDropZoneProps) {
  const dropId = `group:${groupId}:${zone}`;
  const openSlots = Math.max(capacity - players.length, 0);
  const isFull = players.length >= capacity;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    disabled: disabled || isFull || (isMobile && assignMode),
  });

  function handleAssignTap() {
    if (assignMode && onAssignHere) {
      onAssignHere();
    }
  }

  return (
    <div
      ref={setNodeRef}
      role={assignMode ? "button" : undefined}
      tabIndex={assignMode ? 0 : undefined}
      onClick={assignMode ? handleAssignTap : undefined}
      onKeyDown={
        assignMode
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleAssignTap();
              }
            }
          : undefined
      }
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-dashed p-2 transition-colors",
        assignMode
          ? "cursor-pointer border-primary bg-primary/5 ring-2 ring-primary/25"
          : isOver
            ? "border-primary bg-primary/5 ring-2 ring-inset ring-primary/20"
            : "border-border/70 bg-muted/15",
        isFull && !assignMode && "bg-muted/25",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {players.length}/{capacity}
        </span>
      </div>
      {assignMode && (
        <p className="px-0.5 text-xs font-medium text-primary">
          Tap to assign here
        </p>
      )}
      <div
        className="flex min-h-8 flex-wrap items-center gap-1.5"
        onClick={(event) => event.stopPropagation()}
      >
        {players.map((player) => (
          <GroupPlayerPill
            key={player.id}
            player={player}
            groupId={groupId}
            disabled={disabled}
            isMobile={isMobile}
            isSelected={selectedPlayerId === player.id}
            showTeamSides={false}
            sideALabel={label}
            sideBLabel={label}
            onTeamSide={() => {}}
            onSelect={() =>
              onSelectPlayer(
                selectedPlayerId === player.id ? null : player.id
              )
            }
            onRemove={() => onRemovePlayer(player.id)}
          />
        ))}
        {openSlots > 0 &&
          Array.from({ length: openSlots }).map((_, index) => (
            <span
              key={index}
              className="pointer-events-none inline-flex h-8 min-w-14 flex-1 items-center justify-center rounded-md border border-dashed border-border/50 text-[11px] text-muted-foreground/50"
            >
              {players.length === 0 && index === 0 ? "Drop here" : "Open"}
            </span>
          ))}
      </div>
    </div>
  );
}

type GroupPlayerPillProps = {
  player: PairingPlayer;
  groupId: string;
  disabled: boolean;
  isMobile: boolean;
  isSelected: boolean;
  showTeamSides: boolean;
  sideALabel: string;
  sideBLabel: string;
  onTeamSide: (registrationId: string, teamSide: "a" | "b" | null) => void;
  onSelect: () => void;
  onRemove: () => void;
};

function shortPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name.trim();
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  return `${first} ${last}`;
}

function GroupPlayerPill({
  player,
  groupId,
  disabled,
  isMobile,
  isSelected,
  showTeamSides,
  sideALabel,
  sideBLabel,
  onTeamSide,
  onSelect,
  onRemove,
}: GroupPlayerPillProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    disabled: disabled || isMobile,
    data: {
      registrationId: player.id,
      fromGroupId: groupId,
    } satisfies DragPlayerData,
  });

  function cycleTeamSide() {
    const next =
      player.teamSide === "a" ? "b" : player.teamSide === "b" ? null : "a";
    onTeamSide(player.id, next);
  }

  const displayName = shortPlayerName(player.name);

  return (
    <div
      ref={setNodeRef}
      {...(!isMobile ? attributes : {})}
      {...(!isMobile ? listeners : {})}
      onClick={
        isMobile && !disabled
          ? (event) => {
              event.stopPropagation();
              onSelect();
            }
          : undefined
      }
      title={`${player.name}${player.handicap ? ` · HCP ${player.handicap}` : ""} · ${player.email}`}
      className={cn(
        "inline-flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-background px-2 text-xs shadow-xs sm:h-8 sm:gap-2 sm:px-2.5 sm:text-sm",
        isMobile ? "touch-manipulation" : "touch-none select-none",
        isMobile ? "cursor-pointer" : "border-border/80",
        !isMobile &&
          (disabled
            ? "cursor-default opacity-70"
            : "cursor-grab border-border/80 active:cursor-grabbing"),
        isSelected && "border-primary bg-primary/5 ring-2 ring-primary/20",
        !isSelected && isMobile && "border-border/80",
        isDragging && "opacity-40"
      )}
      aria-label={
        isMobile
          ? `Select ${player.name} to move`
          : `Drag ${player.name}`
      }
      aria-pressed={isMobile ? isSelected : undefined}
    >
      {showTeamSides && (
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={cycleTeamSide}
          title={
            player.teamSide === "a"
              ? `${sideALabel} · click to switch`
              : player.teamSide === "b"
                ? `${sideBLabel} · click to switch`
                : "No team · click to assign"
          }
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
            player.teamSide === "a" && "bg-blue-500/15 text-blue-600",
            player.teamSide === "b" && "bg-red-500/15 text-red-600",
            !player.teamSide && "bg-muted text-muted-foreground"
          )}
        >
          {player.teamSide === "a"
            ? sideALabel.charAt(0).toUpperCase()
            : player.teamSide === "b"
              ? sideBLabel.charAt(0).toUpperCase()
              : "–"}
        </button>
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{displayName}</span>
      {player.handicap && (
        <span className="hidden shrink-0 tabular-nums text-xs text-muted-foreground sm:inline">
          {player.handicap}
        </span>
      )}
      <PaymentDot status={player.paymentStatus} />
      {!disabled && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onRemove}
          className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
          aria-label={`Remove ${player.name} from group`}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

type PillVisualProps = {
  player: PairingPlayer;
  showTeamSides: boolean;
  className?: string;
};

function PillVisual({ player, showTeamSides, className }: PillVisualProps) {
  return (
    <div
      className={cn(
        "inline-flex h-8 max-w-52 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs shadow-xs sm:text-sm",
        className
      )}
    >
      {showTeamSides && player.teamSide && (
        <span
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
            player.teamSide === "a"
              ? "bg-blue-500/15 text-blue-600"
              : "bg-red-500/15 text-red-600"
          )}
        >
          {player.teamSide.toUpperCase()}
        </span>
      )}
      <span className="truncate font-medium">{shortPlayerName(player.name)}</span>
      {player.handicap && (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {player.handicap}
        </span>
      )}
    </div>
  );
}

type GroupDetailsSheetProps = {
  group: PairingGroup | null;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  format: string;
  teamSize: number | null;
  startFormat: StartFormat;
  startingHoleOptions: number[];
  showMatchType: boolean;
  showTeamSides: boolean;
  sideALabel: string;
  sideBLabel: string;
  disabled: boolean;
  isPending: boolean;
  setupLocked: boolean;
  showScoringLinks: boolean;
  canEmailPlayers: boolean;
  appUrl: string;
  slug: string;
  unassignedCount: number;
  isMobile: boolean;
  onAddPlayers: () => void;
  onUpdate: (input: GroupUpdateInput) => void;
  onDelete: () => void;
  onTeamSide: (registrationId: string, teamSide: "a" | "b" | null) => void;
  onRemovePlayer: (registrationId: string) => void;
};

function GroupDetailsSheet({
  group,
  onOpenChange,
  eventId,
  format,
  teamSize,
  startFormat,
  startingHoleOptions,
  showMatchType,
  showTeamSides,
  sideALabel,
  sideBLabel,
  disabled,
  isPending,
  setupLocked,
  showScoringLinks,
  canEmailPlayers,
  appUrl,
  slug,
  unassignedCount,
  isMobile,
  onAddPlayers,
  onUpdate,
  onDelete,
  onTeamSide,
  onRemovePlayer,
}: GroupDetailsSheetProps) {
  const [localLabel, setLocalLabel] = useState(group?.label ?? "");
  const pairSides = usesPairSides(format, teamSize);

  useEffect(() => {
    setLocalLabel(group?.label ?? "");
  }, [group?.id, group?.label]);

  const warning = group
    ? getGroupSizeWarning(format, group.players.length, {
        matchType: group.matchType,
        teamACount: group.players.filter((p) => p.teamSide === "a").length,
        teamBCount: group.players.filter((p) => p.teamSide === "b").length,
        teamSize,
      })
    : null;

  const detailPlayers = group
    ? pairSides
      ? [...group.players].sort((a, b) => {
          const order = { a: 0, b: 1 };
          const aOrder = a.teamSide ? (order[a.teamSide as "a" | "b"] ?? 2) : 2;
          const bOrder = b.teamSide ? (order[b.teamSide as "a" | "b"] ?? 2) : 2;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.name.localeCompare(b.name);
        })
      : group.players
    : [];

  const scoringUrl =
    group?.scoringCode != null
      ? getGroupScorePageUrl(appUrl, slug, group.scoringCode)
      : null;

  return (
    <Sheet open={group != null} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton={!isMobile}
        className={cn(
          "gap-0 overflow-hidden",
          isMobile
            ? [
                "inset-x-0 bottom-0 left-0 right-0 w-full max-w-none",
                "h-[min(92dvh,100%)] max-h-[92dvh]",
                "rounded-t-3xl border-x-0 border-b-0 p-0",
              ].join(" ")
            : "w-full sm:max-w-md"
        )}
      >
        {group && (
          <>
            {isMobile && (
              <div className="flex shrink-0 flex-col items-center pt-2.5">
                <div
                  className="h-1 w-10 rounded-full bg-muted-foreground/30"
                  aria-hidden
                />
              </div>
            )}
            <SheetHeader
              className={cn(
                "shrink-0 border-b border-border",
                isMobile
                  ? "gap-1 border-border/50 px-5 pb-4 pt-3 text-left"
                  : "pr-12"
              )}
            >
              <SheetTitle
                className={cn(isMobile && "text-xl font-semibold")}
              >
                {group.label}
              </SheetTitle>
              <SheetDescription>
                {startFormat === "shotgun"
                  ? group.startingHole != null
                    ? `Shotgun · starting hole ${group.startingHole}`
                    : "Shotgun · no starting hole yet"
                  : `Tee time · ${formatTimeDisplay(group.teeTime)}`}
                {" · "}
                {group.players.length} player
                {group.players.length === 1 ? "" : "s"}
              </SheetDescription>
            </SheetHeader>

            <div
              className={cn(
                "min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain",
                isMobile ? "px-5 py-4" : "p-4"
              )}
            >
              {warning && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 sm:text-sm dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{warning}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor="group-details-label"
                  >
                    {showMatchType ? "Match label" : "Group label"}
                  </label>
                  <Input
                    id="group-details-label"
                    value={localLabel}
                    disabled={disabled}
                    onChange={(e) => setLocalLabel(e.target.value)}
                    onBlur={() => {
                      if (
                        localLabel.trim() &&
                        localLabel.trim() !== group.label
                      ) {
                        onUpdate({ label: localLabel.trim() });
                      } else {
                        setLocalLabel(group.label);
                      }
                    }}
                  />
                </div>

                {startFormat === "shotgun" ? (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Starting hole
                    </label>
                    <Select
                      value={
                        group.startingHole != null
                          ? String(group.startingHole)
                          : ""
                      }
                      disabled={disabled}
                      onValueChange={(value) => {
                        if (!value) return;
                        onUpdate({ startingHole: Number(value) });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select hole">
                          {group.startingHole != null
                            ? `Hole ${group.startingHole}`
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {startingHoleOptions.map((hole) => (
                          <SelectItem key={hole} value={String(hole)}>
                            Hole {hole}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Tee time
                    </label>
                    <div className="flex h-9 w-full min-w-0 items-center rounded-lg border border-border bg-muted/30 px-3 text-sm font-medium">
                      {formatTimeDisplay(group.teeTime)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tee times follow the event schedule and group order.
                    </p>
                  </div>
                )}

                {showMatchType && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Match type
                    </label>
                    <Select
                      value={group.matchType ?? ""}
                      disabled={disabled}
                      onValueChange={(value) => {
                        if (!value) return;
                        onUpdate({
                          matchType: value as
                            | "singles"
                            | "fourball"
                            | "foursomes",
                        });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select match type">
                          {getRyderMatchType(group.matchType)?.label}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {RYDER_MATCH_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {group.matchType && (
                      <p className="text-xs text-muted-foreground">
                        {getRyderMatchType(group.matchType)?.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    {pairSides ? "Teams" : "Players"} (
                    {group.players.length})
                  </h4>
                  {isMobile && !setupLocked && unassignedCount > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={disabled}
                      onClick={onAddPlayers}
                    >
                      <UserPlus />
                      Add
                    </Button>
                  )}
                </div>
                {group.players.length === 0 ? (
                  <div className="space-y-3 rounded-lg border border-dashed border-border px-3 py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      {isMobile
                        ? "No players yet."
                        : `No players yet. Drag registrants into this ${showMatchType ? "match" : "group"}.`}
                    </p>
                    {isMobile && !setupLocked && unassignedCount > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-10 w-full"
                        disabled={disabled}
                        onClick={onAddPlayers}
                      >
                        <UserPlus />
                        Add player
                      </Button>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {detailPlayers.map((player) => (
                      <li
                        key={player.id}
                        className="space-y-2 rounded-lg border border-border bg-background p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {player.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {player.email}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <Badge
                                variant="outline"
                                className="capitalize text-[10px]"
                              >
                                {player.paymentStatus}
                              </Badge>
                              {player.handicap && (
                                <span className="text-xs text-muted-foreground">
                                  HCP {player.handicap}
                                </span>
                              )}
                            </div>
                          </div>
                          {!setupLocked && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0"
                              disabled={disabled}
                              aria-label={`Remove ${player.name} from group`}
                              onClick={() => onRemovePlayer(player.id)}
                            >
                              <UserMinus />
                            </Button>
                          )}
                        </div>
                        {(showTeamSides ||
                          (canEmailPlayers &&
                            player.paymentStatus !== "refunded")) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {showTeamSides && (
                              <Select
                                value={
                                  player.teamSide === "a" ||
                                  player.teamSide === "b"
                                    ? player.teamSide
                                    : pairSides
                                      ? undefined
                                      : "none"
                                }
                                disabled={disabled}
                                onValueChange={(value) => {
                                  if (value === "none")
                                    onTeamSide(player.id, null);
                                  else if (value === "a" || value === "b")
                                    onTeamSide(player.id, value);
                                }}
                              >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                  <SelectValue placeholder="Select team">
                                    {player.teamSide === "a"
                                      ? sideALabel
                                      : player.teamSide === "b"
                                        ? sideBLabel
                                        : undefined}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {!pairSides && (
                                    <SelectItem value="none">No team</SelectItem>
                                  )}
                                  <SelectItem value="a">
                                    {sideALabel}
                                  </SelectItem>
                                  <SelectItem value="b">
                                    {sideBLabel}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            {canEmailPlayers &&
                              player.paymentStatus !== "refunded" && (
                                <SendScoringLinkButton
                                  eventId={eventId}
                                  registrationId={player.id}
                                  disabled={isPending}
                                />
                              )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {group.players.length > 0 && group.scoringCode != null && (
                <div className="space-y-2 border-t border-border pt-4">
                  <ButtonLink
                    variant="outline"
                    size="sm"
                    className="h-9 w-full"
                    href={`/print/events/${eventId}/scorecards/${group.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer />
                    <span className="truncate">Print scorecard</span>
                  </ButtonLink>
                  {showScoringLinks && scoringUrl && (
                    <>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h4 className="text-xs font-medium text-muted-foreground">
                          Scoring link
                        </h4>
                        <span className="font-mono text-[11px] tracking-wider">
                          {group.scoringCode}
                        </span>
                      </div>
                      <CopyRegistrationLink url={scoringUrl} />
                    </>
                  )}
                </div>
              )}
            </div>

            {!setupLocked && (
              <SheetFooter
                className={cn(
                  "shrink-0 border-t border-border",
                  isMobile &&
                    "px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
                )}
              >
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-11 w-full"
                  disabled={disabled}
                  onClick={onDelete}
                >
                  <Trash2 />
                  Delete {showMatchType ? "match" : "group"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Players return to the registrants list.
                </p>
              </SheetFooter>
            )}
            {isMobile && setupLocked && (
              <div className="shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => onOpenChange(false)}
                >
                  Done
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

type MobileAssignBarProps = {
  unassignedCount: number;
  selectedPlayer: PairingPlayer | null;
  splitTeams: boolean;
  sideALabel: string;
  sideBLabel: string;
  onOpenPicker: () => void;
  onClearSelection: () => void;
};

function MobileAssignBar({
  unassignedCount,
  selectedPlayer,
  splitTeams,
  sideALabel,
  sideBLabel,
  onOpenPicker,
  onClearSelection,
}: MobileAssignBarProps) {
  if (unassignedCount === 0 && !selectedPlayer) {
    return null;
  }

  const assignHint = splitTeams
    ? `Tap ${sideALabel} or ${sideBLabel} below`
    : "Tap a group below to place them";

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 lg:hidden">
      {selectedPlayer ? (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              Assigning {selectedPlayer.name}
            </p>
            <p className="text-xs text-muted-foreground">{assignHint}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 touch-manipulation"
            onClick={onClearSelection}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          className="h-11 w-full touch-manipulation"
          onClick={onOpenPicker}
        >
          <UserPlus />
          {unassignedCount} unassigned — assign players
        </Button>
      )}
    </div>
  );
}

type PlayerPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: PairingPlayer[];
  search: string;
  onSearchChange: (value: string) => void;
  targetGroup: PairingGroup | null;
  showMatchType: boolean;
  disabled: boolean;
  onSelectPlayer: (playerId: string) => void;
};

function PlayerPickerSheet({
  open,
  onOpenChange,
  players,
  search,
  onSearchChange,
  targetGroup,
  showMatchType,
  disabled,
  onSelectPlayer,
}: PlayerPickerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="inset-x-0 bottom-0 left-0 right-0 h-[min(85dvh,100%)] max-h-[85dvh] w-full max-w-none gap-0 overflow-hidden rounded-t-3xl border-x-0 border-b-0 p-0 lg:hidden"
      >
        <div
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted"
          aria-hidden
        />
        <SheetHeader className="border-b border-border/50 px-5 pb-4 pt-3 text-left">
          <SheetTitle className="text-lg font-semibold">
            {targetGroup
              ? `Add to ${targetGroup.label}`
              : "Select a player"}
          </SheetTitle>
          <SheetDescription>
            {targetGroup
              ? `Choose a registrant to add to this ${showMatchType ? "match" : "group"}.`
              : "Pick a player, then tap a group to assign them."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="relative mb-3 shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search name or email"
              className="h-11 pl-9"
              aria-label="Search registrants"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {players.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {search.trim()
                  ? "No registrants match your search."
                  : "All players are assigned."}
              </p>
            ) : (
              players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  disabled={disabled}
                  className="flex min-h-12 w-full touch-manipulation items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60 disabled:opacity-60"
                  onClick={() => onSelectPlayer(player.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{player.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {player.email}
                    </p>
                  </div>
                  {player.handicap && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      HCP {player.handicap}
                    </span>
                  )}
                  <PaymentDot status={player.paymentStatus} />
                </button>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type TeamSidePickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: PairingGroup | null;
  player: PairingPlayer | null;
  sideALabel: string;
  sideBLabel: string;
  availableSides: ("a" | "b")[];
  disabled: boolean;
  onSelectSide: (teamSide: "a" | "b") => void;
};

function TeamSidePickerSheet({
  open,
  onOpenChange,
  group,
  player,
  sideALabel,
  sideBLabel,
  availableSides,
  disabled,
  onSelectSide,
}: TeamSidePickerSheetProps) {
  if (!group || !player) return null;

  const teamACount = group.players.filter((p) => p.teamSide === "a").length;
  const teamBCount = group.players.filter((p) => p.teamSide === "b").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="inset-x-0 bottom-0 left-0 right-0 w-full max-w-none gap-0 overflow-hidden rounded-t-3xl border-x-0 border-b-0 p-0 lg:hidden"
      >
        <div
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted"
          aria-hidden
        />
        <SheetHeader className="border-b border-border/50 px-5 pb-4 pt-3 text-left">
          <SheetTitle className="text-lg font-semibold">Choose team</SheetTitle>
          <SheetDescription>
            Add {player.name} to {group.label}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {availableSides.includes("a") && (
            <button
              type="button"
              disabled={disabled}
              className="flex min-h-14 w-full touch-manipulation items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60 disabled:opacity-60"
              onClick={() => onSelectSide("a")}
            >
              <div>
                <p className="text-sm font-semibold">{sideALabel}</p>
                <p className="text-xs text-muted-foreground">
                  {teamACount}/2 players
                </p>
              </div>
              <Plus className="size-4 shrink-0 text-muted-foreground" />
            </button>
          )}
          {availableSides.includes("b") && (
            <button
              type="button"
              disabled={disabled}
              className="flex min-h-14 w-full touch-manipulation items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60 disabled:opacity-60"
              onClick={() => onSelectSide("b")}
            >
              <div>
                <p className="text-sm font-semibold">{sideBLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {teamBCount}/2 players
                </p>
              </div>
              <Plus className="size-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function findPlayer(
  pairings: EventPairings,
  registrationId: string
): { player: PairingPlayer; fromGroupId: string | null } | null {
  for (const group of pairings.groups) {
    const player = group.players.find((p) => p.id === registrationId);
    if (player) {
      return { player, fromGroupId: group.id };
    }
  }

  const unassigned = pairings.unassigned.find((p) => p.id === registrationId);
  if (unassigned) {
    return { player: unassigned, fromGroupId: null };
  }

  return null;
}
