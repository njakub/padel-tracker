"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { linkMembershipToPlayer, type LinkState } from "./actions";

type PlayerOption = {
  id: string;
  name: string;
};

type MembershipCardProps = {
  membershipId: string;
  role: string;
  league: { id: string; name: string };
  players: PlayerOption[];
  linkedPlayer: PlayerOption | null;
};

const initialLinkState: LinkState = { status: "idle" };

function roleLabel(role: string) {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "ADMIN":
      return "Admin";
    default:
      return "Member";
  }
}

type SubmitButtonProps = {
  pending: boolean;
  disabled?: boolean;
};

function SubmitButton({ pending, disabled }: SubmitButtonProps) {
  return (
    <Button type="submit" size="sm" disabled={pending || disabled}>
      {pending ? "Saving..." : "Save mapping"}
    </Button>
  );
}

export function MembershipCard(props: MembershipCardProps) {
  const key = `${props.membershipId}-${props.linkedPlayer?.id ?? "none"}`;
  return <MembershipCardInner key={key} {...props} />;
}

function MembershipCardInner({
  membershipId,
  role,
  league,
  players,
  linkedPlayer,
}: MembershipCardProps) {
  const [formState, setFormState] = useState<LinkState>(initialLinkState);
  const [isEditing, setIsEditing] = useState(() => !linkedPlayer);
  const [isPending, startTransition] = useTransition();
  const [resolvedLinkedPlayerId, setResolvedLinkedPlayerId] = useState(
    () => linkedPlayer?.id ?? "none"
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState(
    () => resolvedLinkedPlayerId
  );

  const playerOptions = useMemo(
    () =>
      players.map((player) => (
        <SelectItem key={player.id} value={player.id}>
          {player.name}
        </SelectItem>
      )),
    [players]
  );

  const playerNameLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of players) {
      map.set(player.id, player.name);
    }
    return map;
  }, [players]);

  const handleSubmit = useCallback(
    (formData: FormData) => {
      formData.set("playerId", selectedPlayerId);
      formData.set("membershipId", membershipId);
      startTransition(() => {
        linkMembershipToPlayer(initialLinkState, formData).then((result) => {
          setFormState(result);
          if (result.status === "success") {
            setResolvedLinkedPlayerId(selectedPlayerId);
            setIsEditing(false);
          }
        });
      });
    },
    [membershipId, selectedPlayerId, startTransition]
  );

  const handleStartEditing = useCallback(() => {
    setFormState(initialLinkState);
    setSelectedPlayerId(resolvedLinkedPlayerId);
    setIsEditing(true);
  }, [resolvedLinkedPlayerId]);

  const handleCancel = useCallback(() => {
    setFormState(initialLinkState);
    setSelectedPlayerId(resolvedLinkedPlayerId);
    setIsEditing(false);
  }, [resolvedLinkedPlayerId]);

  const showForm = isEditing;
  const hasChanges = selectedPlayerId !== resolvedLinkedPlayerId;

  const effectiveLinkedPlayerName = useMemo(() => {
    if (formState.status === "success") {
      if (selectedPlayerId === "none") {
        return "Not linked";
      }
      return playerNameLookup.get(selectedPlayerId) ?? "Not linked";
    }

    if (resolvedLinkedPlayerId === "none") {
      return "Not linked";
    }

    return playerNameLookup.get(resolvedLinkedPlayerId) ?? "Not linked";
  }, [
    formState.status,
    playerNameLookup,
    resolvedLinkedPlayerId,
    selectedPlayerId,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {league.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Role: {roleLabel(role)}</span>
          <span>•</span>
          <Link
            href={`/leagues/${league.id}/standings`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Standings
          </Link>
          <span>•</span>
          <Link
            href={`/leagues/${league.id}/schedule`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Schedule
          </Link>
          <span>•</span>
          <Link
            href={`/leagues/${league.id}/matches`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Matches
          </Link>
        </div>

        {!showForm ? (
          <div className="space-y-3 text-sm">
            <p>Linked player: {effectiveLinkedPlayerName}</p>
            {formState.status !== "idle" && formState.message ? (
              <p
                className={`text-xs ${
                  formState.status === "success"
                    ? "text-emerald-600"
                    : "text-destructive"
                }`}
              >
                {formState.message}
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleStartEditing}
            >
              Change link
            </Button>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-3">
            <input type="hidden" name="membershipId" value={membershipId} />
            <input type="hidden" name="playerId" value={selectedPlayerId} />
            <div className="space-y-2">
              <Label htmlFor={`membership-${membershipId}-player`}>
                Link to player record
              </Label>
              <Select
                value={selectedPlayerId}
                onValueChange={setSelectedPlayerId}
                disabled={isPending}
              >
                <SelectTrigger id={`membership-${membershipId}-player`}>
                  <SelectValue placeholder="Select a player" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked player</SelectItem>
                  {playerOptions}
                </SelectContent>
              </Select>
            </div>
            {formState.status === "error" && formState.message ? (
              <p className="text-xs text-destructive">{formState.message}</p>
            ) : null}
            {formState.status === "success" && formState.message ? (
              <p className="text-xs text-emerald-600">{formState.message}</p>
            ) : null}
            <div className="flex items-center gap-2">
              <SubmitButton pending={isPending} disabled={!hasChanges} />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}