"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { autoAssignShotgunHoles } from "@/actions/start-format";
import { CopyRegistrationLink } from "@/components/dashboard/copy-registration-link";
import { SendScoringLinkButton } from "@/components/dashboard/send-scoring-link-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
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
  getEventFormat,
  getGroupSizeWarning,
  getRyderMatchType,
  requiresMatchType,
  requiresTeamSides,
  suggestBestBallTeamSide,
  usesPairSides,
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
  const teamSide = rest.slice(separator + 1);
  if (teamSide === "a" || teamSide === "b") {
    return { groupId, teamSide };
  }

  return { groupId: rest };
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
  teamAName?: string | null;
  teamBName?: string | null;
  pairings: EventPairings;
};

function getGroupCapacity(
  format: string,
  matchType: string | null
): { target: number; max: number } {
  if (format === "ryder_cup") {
    const type = getRyderMatchType(matchType);
    if (type) {
      return { target: type.maxPerSide * 2, max: type.maxPerSide * 2 };
    }
    return { target: 4, max: 4 };
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

  useEffect(() => {
    setLocalPairings(pairings);
  }, [pairings]);

  const sideALabel = usesPairSides(format)
    ? DEFAULT_PAIR_A_LABEL
    : teamAName?.trim() || DEFAULT_TEAM_A_NAME;
  const sideBLabel = usesPairSides(format)
    ? DEFAULT_PAIR_B_LABEL
    : teamBName?.trim() || DEFAULT_TEAM_B_NAME;
  const showTeamSides = requiresTeamSides(format);
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
    onSuccess?: (result: T) => void
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        setLocalPairings(pairings);
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
          usesPairSides(format) && toTeamSide
            ? { ...player, teamSide: toTeamSide }
            : usesPairSides(format)
              ? {
                  ...player,
                  teamSide: suggestBestBallTeamSide(targetGroup.players),
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
        toGroupId === null && usesPairSides(format)
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
    runAction(() =>
      assignRegistrationToGroup(registrationId, toGroupId, toTeamSide)
    );
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
      if (usesPairSides(format)) {
        if (!target.teamSide || target.teamSide === fromTeamSide) return;
      } else {
        return;
      }
    }

    if (
      usesPairSides(format) &&
      target.groupId &&
      target.teamSide
    ) {
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

    handleMovePlayer(data.registrationId, target.groupId, target.teamSide);
  }

  function handleDragCancel() {
    setActivePlayerId(null);
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 shrink-0" />
            Pairings
          </CardTitle>
          <CardDescription className="text-pretty">
            {usesPairSides(format)
              ? "Drag registrants into Pair 1 or Pair 2 in each group."
              : showMatchType
                ? `Drag players into matches and set ${sideALabel} / ${sideBLabel} sides.`
                : "Drag registrants into groups."}{" "}
            <span className="whitespace-nowrap">
              {totalAssigned} assigned · {localPairings.unassigned.length}{" "}
              unassigned
            </span>
            <span className="mt-1 block text-xs sm:text-sm">
              {scheduleSummary}
            </span>
          </CardDescription>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-col sm:items-stretch lg:items-end">
          {localPairings.groups.some((group) => group.players.length > 0) && (
            <ButtonLink
              variant="outline"
              size="sm"
              className="col-span-2 h-10 w-full sm:col-span-1 sm:w-auto"
              href={`/print/events/${eventId}/scorecards`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Printer />
              <span className="truncate">Print scorecards</span>
            </ButtonLink>
          )}
          {startFormat === "shotgun" &&
            localPairings.groups.length > 0 &&
            !setupLocked && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full sm:w-auto"
                disabled={controlsDisabled}
                onClick={() => {
                  autoAssignShotgunHolesLocally();
                  runAction(() => autoAssignShotgunHoles(eventId));
                }}
              >
                Auto-assign holes
              </Button>
            )}
          {!setupLocked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 w-full sm:w-auto"
              disabled={controlsDisabled}
              onClick={handleCreateGroup}
            >
              <Plus />
              {showMatchType ? "Add match" : "Add group"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-4">
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
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden lg:min-h-130 lg:flex-row lg:gap-6">
              <RegistrantsSidebar
                players={filteredUnassigned}
                totalCount={localPairings.unassigned.length}
                search={search}
                onSearchChange={setSearch}
                disabled={controlsDisabled}
              />

              <div className="min-w-0 w-full max-w-full flex-1 space-y-0">
                {localPairings.groups.length > 0 && (
                  <div className="mb-3 flex items-center justify-between lg:hidden">
                    <h3 className="text-sm font-semibold">
                      {showMatchType ? "Matches" : "Groups"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {localPairings.groups.length} total
                    </p>
                  </div>
                )}
                <div className="mb-3 hidden space-y-1 lg:block">
                  <h3 className="text-sm font-semibold">
                    {showMatchType ? "Matches" : "Groups"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {localPairings.groups.length} total · click a group for
                    details
                  </p>
                </div>
                {/* Match registrants search field height so list tops align */}
                <div className="mb-3 hidden h-10 lg:block" aria-hidden />
                {localPairings.groups.length === 0 ? (
                  <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                    <p className="text-sm font-medium">
                      {showMatchType ? "No matches yet" : "No groups yet"}
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {showMatchType
                        ? "Add a match, then drag players from the sidebar into it."
                        : "Add a group, then drag players from the sidebar into it."}
                    </p>
                    {!setupLocked && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        disabled={controlsDisabled}
                        onClick={handleCreateGroup}
                      >
                        <Plus />
                        {showMatchType ? "Add match" : "Add group"}
                      </Button>
                    )}
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
                        }
                      );

                      return (
                        <GroupRow
                          key={group.id}
                          group={group}
                          format={format}
                          startFormat={startFormat}
                          startingHoleOptions={startingHoleOptions}
                          showMatchType={showMatchType}
                          showTeamSides={showTeamSides}
                          sideALabel={sideALabel}
                          sideBLabel={sideBLabel}
                          warning={warning}
                          disabled={controlsDisabled}
                          onUpdate={(input) =>
                            handleUpdateGroup(group.id, input)
                          }
                          onOpenDetails={() => setDetailsGroupId(group.id)}
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
            </div>

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

type RegistrantsSidebarProps = {
  players: PairingPlayer[];
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  disabled: boolean;
};

function RegistrantsSidebar({
  players,
  totalCount,
  search,
  onSearchChange,
  disabled,
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

  return (
    <aside className="flex w-full min-w-0 shrink-0 flex-col overflow-x-hidden lg:w-64 xl:w-72">
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
};

function SidebarPlayerCard({ player, disabled }: SidebarPlayerCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    disabled,
    data: {
      registrationId: player.id,
      fromGroupId: null,
    } satisfies DragPlayerData,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex touch-none select-none items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 shadow-xs",
        disabled
          ? "cursor-not-allowed opacity-70"
          : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
      aria-label={`Drag ${player.name}`}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/70" />
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
  startFormat: StartFormat;
  startingHoleOptions: number[];
  showMatchType: boolean;
  showTeamSides: boolean;
  sideALabel: string;
  sideBLabel: string;
  warning: string | null;
  disabled: boolean;
  onUpdate: (input: GroupUpdateInput) => void;
  onOpenDetails: () => void;
  onTeamSide: (registrationId: string, teamSide: "a" | "b" | null) => void;
  onRemovePlayer: (registrationId: string) => void;
};

function GroupRow({
  group,
  format,
  startFormat,
  startingHoleOptions,
  showMatchType,
  showTeamSides,
  sideALabel,
  sideBLabel,
  warning,
  disabled,
  onUpdate,
  onOpenDetails,
  onTeamSide,
  onRemovePlayer,
}: GroupRowProps) {
  const usePairDropZones = usesPairSides(format);
  const dropId = `group:${group.id}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    disabled: disabled || usePairDropZones,
  });

  const capacity = getGroupCapacity(format, group.matchType);
  const openSlots = Math.max(capacity.target - group.players.length, 0);
  const overCapacity = group.players.length > capacity.max;
  const isFull = group.players.length >= capacity.target && openSlots === 0;
  const pairAPlayers = group.players.filter((player) => player.teamSide === "a");
  const pairBPlayers = group.players.filter((player) => player.teamSide === "b");
  const unassignedPlayers = usePairDropZones
    ? group.players.filter(
        (player) => player.teamSide !== "a" && player.teamSide !== "b"
      )
    : [];

  return (
    <div
      ref={usePairDropZones ? undefined : setNodeRef}
      className={cn(
        "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 transition-colors sm:gap-3 sm:px-3.5 sm:py-3",
        !usePairDropZones && isOver
          ? "border-primary bg-primary/5 ring-2 ring-inset ring-primary/20"
          : "border-border",
        isFull && "bg-muted/15"
      )}
    >
      <div className="flex min-w-0 max-w-40 shrink-0 items-center gap-2 sm:max-w-48">
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
              className="h-8 w-22 shrink-0 px-2.5 text-xs sm:w-24"
              aria-label={`Starting hole for ${group.label}`}
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
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 text-xs font-medium tabular-nums">
            <Clock className="size-3.5 text-muted-foreground" />
            {formatTimeDisplay(group.teeTime)}
          </span>
        )}

        <button
          type="button"
          className="min-w-0 truncate text-left text-sm font-semibold hover:underline"
          onClick={onOpenDetails}
          title={group.label}
        >
          {group.label}
        </button>

        {showMatchType && (
          <Badge
            variant="outline"
            className={cn(
              "hidden shrink-0 text-[10px] sm:inline-flex",
              !group.matchType && "border-amber-500/50 text-amber-600"
            )}
          >
            {getRyderMatchType(group.matchType)?.label ?? "No type"}
          </Badge>
        )}
      </div>

      <div
        className={cn(
          "min-w-0",
          usePairDropZones
            ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
            : "flex items-center gap-1.5",
          !usePairDropZones && group.players.length === 0 && "justify-start"
        )}
      >
        {usePairDropZones ? (
          <>
            <PairDropZone
              groupId={group.id}
              teamSide="a"
              label={sideALabel}
              players={pairAPlayers}
              disabled={disabled}
              onRemovePlayer={onRemovePlayer}
            />
            <PairDropZone
              groupId={group.id}
              teamSide="b"
              label={sideBLabel}
              players={pairBPlayers}
              disabled={disabled}
              onRemovePlayer={onRemovePlayer}
            />
            {unassignedPlayers.length > 0 && (
              <p className="col-span-full text-xs text-amber-600">
                {unassignedPlayers.length} player
                {unassignedPlayers.length === 1 ? "" : "s"} need
                {unassignedPlayers.length === 1 ? "s" : ""} a pair — drag into
                Pair 1 or Pair 2.
              </p>
            )}
          </>
        ) : group.players.length === 0 ? (
          <span className="truncate text-xs text-muted-foreground/70">
            Drop players here
          </span>
        ) : (
          group.players.map((player) => (
            <GroupPlayerPill
              key={player.id}
              player={player}
              groupId={group.id}
              disabled={disabled}
              showTeamSides={showTeamSides}
              sideALabel={sideALabel}
              sideBLabel={sideBLabel}
              onTeamSide={onTeamSide}
              onRemove={() => onRemovePlayer(player.id)}
            />
          ))
        )}
        {!usePairDropZones &&
          openSlots > 0 &&
          Array.from({ length: openSlots }).map((_, index) => (
            <span
              key={index}
              className="hidden h-8 min-w-14 flex-1 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground/45 sm:inline-flex"
            >
              Open
            </span>
          ))}
      </div>

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
    </div>
  );
}

type PairDropZoneProps = {
  groupId: string;
  teamSide: "a" | "b";
  label: string;
  players: PairingPlayer[];
  disabled: boolean;
  onRemovePlayer: (registrationId: string) => void;
};

function PairDropZone({
  groupId,
  teamSide,
  label,
  players,
  disabled,
  onRemovePlayer,
}: PairDropZoneProps) {
  const dropId = `group:${groupId}:${teamSide}`;
  const openSlots = Math.max(2 - players.length, 0);
  const isFull = players.length >= 2;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    disabled: disabled || isFull,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-dashed p-2 transition-colors",
        isOver
          ? "border-primary bg-primary/5 ring-2 ring-inset ring-primary/20"
          : "border-border/70 bg-muted/15",
        isFull && "bg-muted/25"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {players.length}/2
        </span>
      </div>
      <div className="flex min-h-8 flex-wrap items-center gap-1.5">
        {players.map((player) => (
          <GroupPlayerPill
            key={player.id}
            player={player}
            groupId={groupId}
            disabled={disabled}
            showTeamSides={false}
            sideALabel={label}
            sideBLabel={label}
            onTeamSide={() => {}}
            onRemove={() => onRemovePlayer(player.id)}
          />
        ))}
        {openSlots > 0 &&
          Array.from({ length: openSlots }).map((_, index) => (
            <span
              key={index}
              className="inline-flex h-8 min-w-14 flex-1 items-center justify-center rounded-md border border-dashed border-border/50 text-[11px] text-muted-foreground/50"
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
  showTeamSides: boolean;
  sideALabel: string;
  sideBLabel: string;
  onTeamSide: (registrationId: string, teamSide: "a" | "b" | null) => void;
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
  showTeamSides,
  sideALabel,
  sideBLabel,
  onTeamSide,
  onRemove,
}: GroupPlayerPillProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    disabled,
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
      {...attributes}
      {...listeners}
      title={`${player.name}${player.handicap ? ` · HCP ${player.handicap}` : ""} · ${player.email}`}
      className={cn(
        "inline-flex h-8 min-w-0 flex-1 touch-none select-none items-center gap-1.5 rounded-md border border-border/80 bg-background px-2 text-xs shadow-xs sm:gap-2 sm:px-2.5 sm:text-sm",
        disabled
          ? "cursor-default opacity-70"
          : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
      aria-label={`Drag ${player.name}`}
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
  onUpdate,
  onDelete,
  onTeamSide,
  onRemovePlayer,
}: GroupDetailsSheetProps) {
  const [localLabel, setLocalLabel] = useState(group?.label ?? "");

  useEffect(() => {
    setLocalLabel(group?.label ?? "");
  }, [group?.id, group?.label]);

  const warning = group
    ? getGroupSizeWarning(format, group.players.length, {
        matchType: group.matchType,
        teamACount: group.players.filter((p) => p.teamSide === "a").length,
        teamBCount: group.players.filter((p) => p.teamSide === "b").length,
      })
    : null;

  const detailPlayers = group
    ? usesPairSides(format)
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
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        {group && (
          <>
            <SheetHeader className="border-b border-border pr-12">
              <SheetTitle>{group.label}</SheetTitle>
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

            <div className="flex-1 space-y-6 overflow-y-auto p-4">
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
                <h4 className="text-xs font-medium text-muted-foreground">
                  {usesPairSides(format) ? "Pairs" : "Players"} (
                  {group.players.length})
                </h4>
                {group.players.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    No players yet. Drag registrants into this{" "}
                    {showMatchType ? "match" : "group"}.
                  </p>
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
                                value={player.teamSide ?? "none"}
                                disabled={disabled}
                                onValueChange={(value) => {
                                  if (value === "none")
                                    onTeamSide(player.id, null);
                                  else if (value === "a" || value === "b")
                                    onTeamSide(player.id, value);
                                }}
                              >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                  <SelectValue placeholder="Team">
                                    {player.teamSide === "a"
                                      ? sideALabel
                                      : player.teamSide === "b"
                                        ? sideBLabel
                                        : undefined}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {!usesPairSides(format) && (
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

              {showScoringLinks &&
                group.players.length > 0 &&
                group.scoringCode != null &&
                scoringUrl && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h4 className="text-xs font-medium text-muted-foreground">
                        Scoring link
                      </h4>
                      <span className="font-mono text-[11px] tracking-wider">
                        {group.scoringCode}
                      </span>
                    </div>
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
                    <CopyRegistrationLink url={scoringUrl} />
                  </div>
                )}
            </div>

            {!setupLocked && (
              <SheetFooter className="border-t border-border">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full"
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
          </>
        )}
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
