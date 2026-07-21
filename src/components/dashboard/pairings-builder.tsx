"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
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

  const router = useRouter();
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
    useSensor(KeyboardSensor)
  );

  function refreshAfter(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        setLocalPairings(pairings);
        return;
      }
      router.refresh();
    });
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
    refreshAfter(() =>
      assignRegistrationToGroup(data.registrationId, targetGroupId)
    );
  }

  function handleDragCancel() {
    setActivePlayerId(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" />
            Pairings
          </CardTitle>
          <CardDescription>
            {showMatchType
              ? `Drag players into matches and set ${sideALabel} / ${sideBLabel} sides.`
              : "Drag registrants from the sidebar into groups."}{" "}
            {totalAssigned} assigned, {localPairings.unassigned.length} unassigned.
            <span className="mt-1 block">{scheduleSummary}</span>
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {localPairings.groups.some((group) => group.players.length > 0) && (
            <ButtonLink
              variant="outline"
              size="sm"
              href={`/print/events/${eventId}/scorecards`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Printer />
              Print all scorecards
            </ButtonLink>
          )}
          {startFormat === "shotgun" &&
            localPairings.groups.length > 0 &&
            !setupLocked && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={controlsDisabled}
                onClick={() => refreshAfter(() => autoAssignShotgunHoles(eventId))}
              >
                Auto-assign holes
              </Button>
            )}
          {!setupLocked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={controlsDisabled}
              onClick={() => refreshAfter(() => createPairingGroup(eventId))}
            >
              <Plus />
              {showMatchType ? "Add match" : "Add group"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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
            <div className="flex min-h-[520px] min-w-0 flex-col gap-4 overflow-x-hidden lg:flex-row lg:gap-6">
              <RegistrantsSidebar
                players={filteredUnassigned}
                totalCount={localPairings.unassigned.length}
                search={search}
                onSearchChange={setSearch}
                disabled={controlsDisabled}
              />

              <div className="min-w-0 flex-1 space-y-4">
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
                          refreshAfter(() => createPairingGroup(eventId))
                        }
                      >
                        <Plus />
                        {showMatchType ? "Add match" : "Add group"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
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
                          onUpdate={(input) =>
                            refreshAfter(() => updatePairingGroup(group.id, input))
                          }
                          onDelete={() =>
                            refreshAfter(() => deletePairingGroup(group.id))
                          }
                          onTeamSide={(registrationId, teamSide) =>
                            refreshAfter(() =>
                              assignRegistrationTeamSide(registrationId, teamSide)
                            )
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
                <div className="w-72 max-w-[calc(100vw-2rem)]">
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
  const { isOver, setNodeRef } = useDroppable({
    id: UNASSIGNED_DROP_ID,
    disabled,
  });

  return (
    <aside className="flex w-full min-w-0 shrink-0 flex-col overflow-x-hidden lg:w-72 xl:w-80">
      <div className="mb-3 space-y-1">
        <h3 className="text-sm font-semibold">Registrants</h3>
        <p className="text-xs text-muted-foreground">
          {totalCount} unassigned · drag into a group
        </p>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name or email"
          className="pl-9"
          aria-label="Search registrants"
        />
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-64 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto rounded-xl border bg-muted/10 p-3 transition-colors lg:max-h-[calc(100vh-18rem)]",
          isOver && "border-primary bg-primary/5 ring-2 ring-primary/20",
          !isOver && "border-border"
        )}
      >
        {totalCount === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            All players are assigned.
          </p>
        ) : players.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
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
    <div className="flex flex-col rounded-xl border border-border bg-muted/20">
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
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={cn(
          "mx-4 mb-4 min-h-28 flex-1 rounded-lg border border-dashed p-3 transition-colors",
          group.players.length === 0 && "flex items-center justify-center",
          isOver
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
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
    <div className="space-y-3 p-4 pb-3">
      <div className="flex items-start justify-between gap-3">
        <Badge variant="secondary" className="shrink-0 font-medium">
          {startFormat === "shotgun" ? "Starting hole" : "Tee time"} ·{" "}
          {scheduleBadge}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label="Delete group"
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="flex h-9 items-center rounded-lg border border-border bg-muted/30 px-3 text-sm font-medium">
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
        <div className="space-y-1.5 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Scoring link
              {scoringCode ? (
                <span className="ml-2 font-mono text-[11px] tracking-wider text-foreground">
                  {scoringCode}
                </span>
              ) : null}
            </p>
            <ButtonLink
              variant="outline"
              size="sm"
              href={`/print/events/${eventId}/scorecards/${groupId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Printer />
              Print scorecard
            </ButtonLink>
          </div>
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
          <div className="flex flex-wrap items-center gap-1.5">
            {canEmailPlayers && player.paymentStatus !== "refunded" && (
              <SendScoringLinkButton
                eventId={eventId}
                registrationId={player.id}
                disabled={isPending}
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
                <SelectTrigger className="h-8 w-28 text-xs">
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
          "flex w-full max-w-full items-start gap-2 rounded-lg border border-border bg-background px-2.5 py-2 shadow-sm",
          isDragging && "opacity-40",
          isOverlay && "opacity-100 shadow-md ring-2 ring-primary/30",
          disabled && "opacity-70"
        )}
      >
        <button
          type="button"
          className={cn(
            "mt-0.5 shrink-0 touch-none text-muted-foreground",
            disabled
              ? "cursor-not-allowed"
              : "cursor-grab active:cursor-grabbing"
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
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="outline" className="capitalize text-[10px]">
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
