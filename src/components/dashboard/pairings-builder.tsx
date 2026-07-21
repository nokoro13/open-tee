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
  forwardRef,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ChevronDown,
  GripVertical,
  Plus,
  Printer,
  Search,
  Trash2,
  Users,
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
  DEFAULT_TEAM_A_NAME,
  DEFAULT_TEAM_B_NAME,
  RYDER_MATCH_TYPES,
  getGroupSizeWarning,
  getRyderMatchType,
  requiresMatchType,
  requiresTeamSides,
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

type DragPlayerData = {
  registrationId: string;
  fromGroupId: string | null;
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

  useEffect(() => {
    setLocalPairings(pairings);
  }, [pairings]);

  const sideALabel = teamAName?.trim() || DEFAULT_TEAM_A_NAME;
  const sideBLabel = teamBName?.trim() || DEFAULT_TEAM_B_NAME;
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

  function updateGroupLocally(
    groupId: string,
    input: {
      label?: string;
      teeTime?: string | null;
      startingHole?: number | null;
      matchType?: "singles" | "fourball" | "foursomes" | null;
    }
  ) {
    setLocalPairings((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === groupId ? { ...group, ...input } : group
      ),
    }));
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

  function updateTeamSideLocally(
    registrationId: string,
    teamSide: "a" | "b" | null
  ) {
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
    fromGroupId: string | null,
    toGroupId: string | null
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
        groups[targetIndex] = {
          ...groups[targetIndex],
          players: [...groups[targetIndex].players, player].sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
        };
      }

      const unassigned =
        toGroupId === null
          ? [...current.unassigned.filter((p) => p.id !== registrationId), player].sort(
              (a, b) => a.name.localeCompare(b.name)
            )
          : current.unassigned.filter((p) => p.id !== registrationId);

      return { groups, unassigned };
    });
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
    let targetGroupId: string | null = null;

    if (overId === UNASSIGNED_DROP_ID) {
      targetGroupId = null;
    } else if (overId.startsWith("group:")) {
      targetGroupId = overId.slice("group:".length);
    } else {
      return;
    }

    if (data.fromGroupId === targetGroupId) return;

    movePlayerLocally(data.registrationId, data.fromGroupId, targetGroupId);
    runAction(() =>
      assignRegistrationToGroup(data.registrationId, targetGroupId)
    );
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
            {showMatchType
              ? `Drag players into matches and set ${sideALabel} / ${sideBLabel} sides.`
              : "Drag registrants into groups."}{" "}
            <span className="whitespace-nowrap">
              {totalAssigned} assigned · {localPairings.unassigned.length} unassigned
            </span>
            <span className="mt-1 block text-xs sm:text-sm">{scheduleSummary}</span>
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
              onClick={() =>
                runAction(() => createPairingGroup(eventId), (result) => {
                  if ("group" in result && result.group) {
                    setLocalPairings((current) => ({
                      ...current,
                      groups: [...current.groups, result.group],
                    }));
                  }
                })
              }
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
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden lg:min-h-[520px] lg:flex-row lg:gap-6">
              <RegistrantsSidebar
                players={filteredUnassigned}
                totalCount={localPairings.unassigned.length}
                search={search}
                onSearchChange={setSearch}
                disabled={controlsDisabled}
              />

              <div className="min-w-0 w-full max-w-full flex-1 space-y-3">
                {localPairings.groups.length > 0 && (
                  <div className="flex items-center justify-between lg:hidden">
                    <h3 className="text-sm font-semibold">
                      {showMatchType ? "Matches" : "Groups"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {localPairings.groups.length} total
                    </p>
                  </div>
                )}
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
                        onClick={() =>
                          runAction(() => createPairingGroup(eventId), (result) => {
                            if ("group" in result && result.group) {
                              setLocalPairings((current) => ({
                                ...current,
                                groups: [...current.groups, result.group],
                              }));
                            }
                          })
                        }
                      >
                        <Plus />
                        {showMatchType ? "Add match" : "Add group"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid min-w-0 w-full max-w-full gap-4 xl:grid-cols-2">
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
                        <GroupCard
                          key={group.id}
                          eventId={eventId}
                          group={group}
                          startFormat={startFormat}
                          startingHoleOptions={startingHoleOptions}
                          showMatchType={showMatchType}
                          showTeamSides={showTeamSides}
                          sideALabel={sideALabel}
                          sideBLabel={sideBLabel}
                          warning={warning}
                          disabled={controlsDisabled}
                          isPending={isPending}
                          showScoringLinks={showScoringLinks}
                          canEmailPlayers={canEmailPlayers}
                          appUrl={appUrl}
                          slug={slug}
                          onUpdate={(input) => {
                            updateGroupLocally(group.id, input);
                            runAction(() => updatePairingGroup(group.id, input));
                          }}
                          onDelete={() => {
                            deleteGroupLocally(group.id);
                            runAction(() => deletePairingGroup(group.id));
                          }}
                          onTeamSide={(registrationId, teamSide) => {
                            updateTeamSideLocally(registrationId, teamSide);
                            runAction(() =>
                              assignRegistrationTeamSide(registrationId, teamSide)
                            );
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DragOverlay dropAnimation={null}>
              {activePlayer ? (
                <div className="w-[min(100vw-2rem,18rem)] touch-none">
                  <PlayerChip player={activePlayer} isOverlay disabled />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
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
    <aside className="flex w-full min-w-0 shrink-0 flex-col overflow-x-hidden lg:w-72 xl:w-80">
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
            isOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20"
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
          className={cn(
            "flex flex-col",
            !mobileExpanded && "hidden lg:flex"
          )}
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
              "flex min-h-40 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto rounded-xl border bg-muted/10 p-2.5 sm:p-3 lg:max-h-[calc(100vh-18rem)]",
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
    <PlayerChip
      ref={setNodeRef}
      player={player}
      disabled={disabled}
      isDragging={isDragging}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

type GroupCardProps = {
  eventId: string;
  group: EventPairings["groups"][number];
  startFormat: StartFormat;
  startingHoleOptions: number[];
  showMatchType: boolean;
  showTeamSides: boolean;
  sideALabel: string;
  sideBLabel: string;
  warning: string | null;
  disabled: boolean;
  isPending: boolean;
  showScoringLinks: boolean;
  canEmailPlayers: boolean;
  appUrl: string;
  slug: string;
  onUpdate: (input: {
    label?: string;
    teeTime?: string | null;
    startingHole?: number | null;
    matchType?: "singles" | "fourball" | "foursomes" | null;
  }) => void;
  onDelete: () => void;
  onTeamSide: (registrationId: string, teamSide: "a" | "b" | null) => void;
};

function GroupCard({
  eventId,
  group,
  startFormat,
  startingHoleOptions,
  showMatchType,
  showTeamSides,
  sideALabel,
  sideBLabel,
  warning,
  disabled,
  isPending,
  showScoringLinks,
  canEmailPlayers,
  appUrl,
  slug,
  onUpdate,
  onDelete,
  onTeamSide,
}: GroupCardProps) {
  const dropId = `group:${group.id}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    disabled,
  });

  const scheduleBadge =
    startFormat === "shotgun"
      ? group.startingHole != null
        ? `Hole ${group.startingHole}`
        : "No hole"
      : formatTimeDisplay(group.teeTime);

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-muted/20">
      <GroupHeader
        eventId={eventId}
        groupId={group.id}
        label={group.label}
        teeTime={group.teeTime}
        startingHole={group.startingHole}
        startFormat={startFormat}
        startingHoleOptions={startingHoleOptions}
        matchType={group.matchType}
        showMatchType={showMatchType}
        scheduleBadge={scheduleBadge}
        disabled={disabled}
        scoringCode={group.scoringCode}
        scoringUrl={
          group.scoringCode
            ? getGroupScorePageUrl(appUrl, slug, group.scoringCode)
            : null
        }
        showScoringLink={
          showScoringLinks && group.players.length > 0 && group.scoringCode != null
        }
        onUpdate={onUpdate}
        onDelete={onDelete}
      />

      {warning && (
        <div className="mx-3 mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 sm:text-sm dark:text-amber-100 lg:mx-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={cn(
          "mx-3 mb-3 min-h-24 flex-1 rounded-lg border border-dashed p-2.5 transition-colors sm:min-h-28 sm:p-3 lg:mx-4 lg:mb-4",
          group.players.length === 0 && "flex items-center justify-center",
          isOver
            ? "border-primary bg-primary/5 ring-2 ring-inset ring-primary/20"
            : "border-border/80 bg-background/60"
        )}
      >
        {group.players.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Drop players here
          </p>
        ) : (
          <ul className="space-y-2">
            {group.players.map((player) => (
              <li key={player.id}>
                <GroupPlayerRow
                  player={player}
                  groupId={group.id}
                  showTeamSides={showTeamSides}
                  sideALabel={sideALabel}
                  sideBLabel={sideBLabel}
                  disabled={disabled}
                  isPending={isPending}
                  canEmailPlayers={canEmailPlayers}
                  eventId={eventId}
                  onTeamSide={onTeamSide}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type GroupHeaderProps = {
  eventId: string;
  groupId: string;
  label: string;
  teeTime: string | null;
  startingHole: number | null;
  startFormat: StartFormat;
  startingHoleOptions: number[];
  matchType: string | null;
  showMatchType: boolean;
  scheduleBadge: string;
  disabled: boolean;
  scoringCode?: string | null;
  scoringUrl?: string | null;
  showScoringLink?: boolean;
  onUpdate: (input: {
    label?: string;
    teeTime?: string | null;
    startingHole?: number | null;
    matchType?: "singles" | "fourball" | "foursomes" | null;
  }) => void;
  onDelete: () => void;
};

function GroupHeader({
  eventId,
  groupId,
  label,
  teeTime,
  startingHole,
  startFormat,
  startingHoleOptions,
  matchType,
  showMatchType,
  scheduleBadge,
  disabled,
  scoringCode,
  scoringUrl,
  showScoringLink,
  onUpdate,
  onDelete,
}: GroupHeaderProps) {
  const [localLabel, setLocalLabel] = useState(label);

  useEffect(() => {
    setLocalLabel(label);
  }, [label]);

  return (
    <div className="min-w-0 space-y-3 overflow-hidden p-3 pb-2 sm:p-4 sm:pb-3">
      <div className="flex items-start justify-between gap-2">
        <Badge
          variant="secondary"
          className="max-w-[calc(100%-2.5rem)] shrink font-medium text-[11px] sm:text-xs"
        >
          <span className="truncate">
            {startFormat === "shotgun" ? "Starting hole" : "Tee time"} ·{" "}
            {scheduleBadge}
          </span>
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          disabled={disabled}
          aria-label="Delete group"
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>

      <div className="grid min-w-0 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {showMatchType ? "Match label" : "Group label"}
          </label>
          <Input
            value={localLabel}
            disabled={disabled}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={() => {
              if (localLabel.trim() && localLabel.trim() !== label) {
                onUpdate({ label: localLabel.trim() });
              } else {
                setLocalLabel(label);
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
              value={startingHole != null ? String(startingHole) : ""}
              disabled={disabled}
              onValueChange={(value) => {
                if (!value) return;
                onUpdate({ startingHole: Number(value) });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select hole">
                  {startingHole != null ? `Hole ${startingHole}` : undefined}
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
              {formatTimeDisplay(teeTime)}
            </div>
          </div>
        )}
      </div>

      {showMatchType && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Match type
          </label>
          <Select
            value={matchType ?? ""}
            disabled={disabled}
            onValueChange={(value) => {
              if (!value) return;
              onUpdate({
                matchType: value as "singles" | "fourball" | "foursomes",
              });
            }}
          >
            <SelectTrigger className="w-full sm:max-w-xs">
              <SelectValue placeholder="Select match type">
                {getRyderMatchType(matchType)?.label}
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
        </div>
      )}

      {showScoringLink && scoringUrl && (
        <div className="min-w-0 space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Scoring link
            </span>
            {scoringCode ? (
              <span className="font-mono text-[10px] tracking-wider text-foreground sm:text-[11px]">
                {scoringCode}
              </span>
            ) : null}
          </div>
          <ButtonLink
            variant="outline"
            size="sm"
            className="h-9 w-full max-w-full"
            href={`/print/events/${eventId}/scorecards/${groupId}`}
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
  );
}

type GroupPlayerRowProps = {
  player: PairingPlayer;
  groupId: string;
  showTeamSides: boolean;
  sideALabel: string;
  sideBLabel: string;
  disabled: boolean;
  isPending: boolean;
  canEmailPlayers: boolean;
  eventId: string;
  onTeamSide: (registrationId: string, teamSide: "a" | "b" | null) => void;
};

function GroupPlayerRow({
  player,
  groupId,
  showTeamSides,
  sideALabel,
  sideBLabel,
  disabled,
  isPending,
  canEmailPlayers,
  eventId,
  onTeamSide,
}: GroupPlayerRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    disabled,
    data: {
      registrationId: player.id,
      fromGroupId: groupId,
    } satisfies DragPlayerData,
  });

  const teamValue = player.teamSide ?? "none";

  return (
    <div className="space-y-2">
      <PlayerChip
        ref={setNodeRef}
        player={player}
        disabled={disabled}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
        trailing={
          <div className="flex w-full min-w-0 max-w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            {canEmailPlayers && player.paymentStatus !== "refunded" && (
              <SendScoringLinkButton
                eventId={eventId}
                registrationId={player.id}
                disabled={isPending}
                className="w-full sm:w-auto"
              />
            )}
            {showTeamSides && (
              <Select
                value={teamValue}
                disabled={disabled}
                onValueChange={(value) => {
                  if (value === "none") onTeamSide(player.id, null);
                  else if (value === "a" || value === "b")
                    onTeamSide(player.id, value);
                }}
              >
                <SelectTrigger className="h-9 w-full min-w-0 text-xs sm:h-8 sm:w-28">
                  <SelectValue placeholder="Team">
                    {teamValue === "a"
                      ? sideALabel
                      : teamValue === "b"
                        ? sideBLabel
                        : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team</SelectItem>
                  <SelectItem value="a">{sideALabel}</SelectItem>
                  <SelectItem value="b">{sideBLabel}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />
    </div>
  );
}

type PlayerChipProps = {
  player: PairingPlayer;
  disabled?: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  style?: CSSProperties;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  trailing?: ReactNode;
};

const PlayerChip = forwardRef<HTMLDivElement, PlayerChipProps>(
  function PlayerChip(
    {
      player,
      disabled,
      isDragging,
      isOverlay,
      style,
      dragHandleProps,
      trailing,
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        style={style}
        className={cn(
          "flex w-full max-w-full flex-col gap-2 rounded-lg border border-border bg-background px-2.5 py-2.5 shadow-sm sm:flex-row sm:items-start sm:py-2",
          isDragging && "opacity-40",
          isOverlay && "opacity-100 shadow-md ring-2 ring-primary/30",
          disabled && "opacity-70"
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            type="button"
            className={cn(
              "mt-0.5 shrink-0 touch-none rounded-md p-0.5 text-muted-foreground",
              disabled
                ? "cursor-not-allowed"
                : "cursor-grab active:cursor-grabbing active:bg-muted"
            )}
            aria-label={`Drag ${player.name}`}
            disabled={disabled}
            {...dragHandleProps}
          >
            <GripVertical className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{player.name}</p>
            <p className="truncate text-xs text-muted-foreground">{player.email}</p>
            {player.handicap && (
              <p className="text-xs text-muted-foreground">
                HCP {player.handicap}
              </p>
            )}
          </div>
        </div>
        <div className="flex w-full min-w-0 max-w-full flex-col gap-1.5 pl-7 sm:w-auto sm:max-w-full sm:shrink-0 sm:pl-0">
          <Badge variant="outline" className="w-fit capitalize text-[10px]">
            {player.paymentStatus}
          </Badge>
          {trailing}
        </div>
      </div>
    );
  }
);

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
