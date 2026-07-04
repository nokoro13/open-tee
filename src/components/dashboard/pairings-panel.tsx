"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Plus, Trash2, Users } from "lucide-react";

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
import type { EventPairings } from "@/lib/pairings";
import { getGroupScorePageUrl } from "@/lib/scoring-code-storage";
import {
  formatTimeDisplay,
  getStartingHoleOptions,
  getStartFormatSummary,
  type StartFormat,
} from "@/lib/start-format";

type PairingsPanelProps = {
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

export function PairingsPanel({
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
}: PairingsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sideALabel = teamAName?.trim() || DEFAULT_TEAM_A_NAME;
  const sideBLabel = teamBName?.trim() || DEFAULT_TEAM_B_NAME;
  const showTeamSides = requiresTeamSides(format);
  const showMatchType = requiresMatchType(format);

  function refreshAfter(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  function handleCreateGroup() {
    refreshAfter(() => createPairingGroup(eventId));
  }

  function handleDeleteGroup(groupId: string) {
    refreshAfter(() => deletePairingGroup(groupId));
  }

  function handleAssign(registrationId: string, groupId: string | null) {
    refreshAfter(() => assignRegistrationToGroup(registrationId, groupId));
  }

  function handleTeamSide(registrationId: string, teamSide: "a" | "b" | null) {
    refreshAfter(() => assignRegistrationTeamSide(registrationId, teamSide));
  }

  const groupOptions = pairings.groups.map((group) => ({
    id: group.id,
    label: group.label,
  }));

  function handleAutoAssignHoles() {
    refreshAfter(() => autoAssignShotgunHoles(eventId));
  }

  const totalAssigned = pairings.groups.reduce(
    (sum, group) => sum + group.players.length,
    0
  );
  const showScoringLinks = scoringStatus !== "disabled";
  const canEmailPlayers = scoringStatus === "open";
  const startingHoleOptions = getStartingHoleOptions(holes);
  const scheduleSummary = getStartFormatSummary({
    startFormat,
    shotgunStartTime,
    firstTeeTime,
    teeTimeIntervalMinutes,
  });

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
              ? `Create matches, set match type, and assign ${sideALabel} / ${sideBLabel} players.`
              : `Assign players to groups manually.`}{" "}
            {totalAssigned} assigned, {pairings.unassigned.length} unassigned.
            <span className="mt-1 block">{scheduleSummary}</span>
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {startFormat === "shotgun" && pairings.groups.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleAutoAssignHoles}
            >
              Auto-assign holes
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleCreateGroup}
          >
            <Plus />
            {showMatchType ? "Add match" : "Add group"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {pairings.groups.length === 0 && pairings.unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No registrations yet. Pairings will appear once players sign up.
          </p>
        ) : (
          <>
            {pairings.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {showMatchType
                  ? "Add a match to start building the Ryder Cup schedule."
                  : "Add a group to start assigning players."}
              </p>
            ) : (
              <ul className="space-y-4">
                {pairings.groups.map((group) => {
                  const teamACount = group.players.filter((p) => p.teamSide === "a").length;
                  const teamBCount = group.players.filter((p) => p.teamSide === "b").length;
                  const warning = getGroupSizeWarning(format, group.players.length, {
                    matchType: group.matchType,
                    teamACount,
                    teamBCount,
                  });

                  return (
                    <li
                      key={group.id}
                      className="rounded-lg border border-border bg-muted/20 p-4"
                    >
                      <GroupHeader
                        label={group.label}
                        teeTime={group.teeTime}
                        startingHole={group.startingHole}
                        startFormat={startFormat}
                        startingHoleOptions={startingHoleOptions}
                        matchType={group.matchType}
                        showMatchType={showMatchType}
                        disabled={isPending}
                        scoringCode={group.scoringCode}
                        scoringUrl={
                          group.scoringCode
                            ? getGroupScorePageUrl(appUrl, slug, group.scoringCode)
                            : null
                        }
                        showScoringLink={
                          showScoringLinks &&
                          group.players.length > 0 &&
                          group.scoringCode != null
                        }
                        onUpdate={(input) =>
                          refreshAfter(() => updatePairingGroup(group.id, input))
                        }
                        onDelete={() => handleDeleteGroup(group.id)}
                      />

                      {warning && (
                        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                          <span>{warning}</span>
                        </div>
                      )}

                      {group.players.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          No players assigned yet.
                        </p>
                      ) : (
                        <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-background">
                          {group.players.map((player) => (
                            <li key={player.id}>
                              <PlayerRow
                                player={player}
                                groupOptions={groupOptions}
                                currentGroupId={group.id}
                                showTeamSides={showTeamSides}
                                sideALabel={sideALabel}
                                sideBLabel={sideBLabel}
                                disabled={isPending}
                                eventId={eventId}
                                canEmailPlayer={canEmailPlayers}
                                onAssign={handleAssign}
                                onTeamSide={handleTeamSide}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-medium">
                Unassigned ({pairings.unassigned.length})
              </h3>
              {pairings.unassigned.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All registered players are assigned.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {pairings.unassigned.map((player) => (
                    <li key={player.id}>
                      <PlayerRow
                        player={player}
                        groupOptions={groupOptions}
                        currentGroupId={null}
                        showTeamSides={showTeamSides}
                        sideALabel={sideALabel}
                        sideBLabel={sideBLabel}
                        disabled={isPending}
                        eventId={eventId}
                        canEmailPlayer={canEmailPlayers}
                        onAssign={handleAssign}
                        onTeamSide={handleTeamSide}
                      />
                      {showScoringLinks && player.scoringCode && (
                        <div className="space-y-1.5 border-t border-border px-3 pb-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            Scoring link
                          </p>
                          <CopyRegistrationLink
                            url={getGroupScorePageUrl(
                              appUrl,
                              slug,
                              player.scoringCode
                            )}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type GroupHeaderProps = {
  label: string;
  teeTime: string | null;
  startingHole: number | null;
  startFormat: StartFormat;
  startingHoleOptions: number[];
  matchType: string | null;
  showMatchType: boolean;
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
  label,
  teeTime,
  startingHole,
  startFormat,
  startingHoleOptions,
  matchType,
  showMatchType,
  disabled,
  scoringCode,
  scoringUrl,
  showScoringLink,
  onUpdate,
  onDelete,
}: GroupHeaderProps) {
  const [localLabel, setLocalLabel] = useState(label);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
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
          {matchType && (
            <p className="text-xs text-muted-foreground">
              {RYDER_MATCH_TYPES.find((t) => t.value === matchType)?.description}
            </p>
          )}
        </div>
      )}

      {showScoringLink && scoringUrl && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Scoring link
            {scoringCode ? (
              <span className="ml-2 font-mono text-[11px] tracking-wider text-foreground">
                {scoringCode}
              </span>
            ) : null}
          </p>
          <CopyRegistrationLink url={scoringUrl} />
        </div>
      )}
    </div>
  );
}

type PlayerRowProps = {
  player: {
    id: string;
    name: string;
    email: string;
    handicap: string | null;
    paymentStatus: string;
    teamSide: string | null;
  };
  groupOptions: { id: string; label: string }[];
  currentGroupId: string | null;
  showTeamSides: boolean;
  sideALabel: string;
  sideBLabel: string;
  disabled: boolean;
  eventId: string;
  canEmailPlayer: boolean;
  onAssign: (registrationId: string, groupId: string | null) => void;
  onTeamSide: (registrationId: string, teamSide: "a" | "b" | null) => void;
};

function PlayerRow({
  player,
  groupOptions,
  currentGroupId,
  showTeamSides,
  sideALabel,
  sideBLabel,
  disabled,
  eventId,
  canEmailPlayer,
  onAssign,
  onTeamSide,
}: PlayerRowProps) {
  const selectValue = currentGroupId ?? "unassigned";
  const teamValue = player.teamSide ?? "none";

  return (
    <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{player.name}</p>
        <p className="truncate text-sm text-muted-foreground">{player.email}</p>
        {player.handicap && (
          <p className="text-xs text-muted-foreground">
            Handicap: {player.handicap}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {canEmailPlayer && player.paymentStatus !== "refunded" && (
          <SendScoringLinkButton
            eventId={eventId}
            registrationId={player.id}
            disabled={disabled}
          />
        )}
        <Badge variant="outline" className="capitalize">
          {player.paymentStatus}
        </Badge>
        {showTeamSides && (
          <Select
            value={teamValue}
            disabled={disabled}
            onValueChange={(value) => {
              if (value === "none") onTeamSide(player.id, null);
              else if (value === "a" || value === "b") onTeamSide(player.id, value);
            }}
          >
            <SelectTrigger className="w-full min-w-28 sm:w-32">
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
        <Select
          value={selectValue}
          disabled={disabled || groupOptions.length === 0}
          onValueChange={(value) => {
            onAssign(player.id, value === "unassigned" ? null : value);
          }}
        >
          <SelectTrigger className="w-full min-w-36 sm:w-40">
            <SelectValue placeholder="Assign group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {groupOptions.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
