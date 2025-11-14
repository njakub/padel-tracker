"use client";

import { MatchSide, MatchStatus } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateMatch } from "../matches/actions";
import { useFormStatus } from "react-dom";

const COURT_OPTIONS = [
  "The Padel Hub - Reading",
  "The Atrium",
  "PadelStars Reading",
] as const;

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save changes"}
    </Button>
  );
}

type PlayerOption = {
  id: string;
  name: string | null;
};

type MatchForEdit = {
  id: string;
  seasonId: string;
  matchNumber: number;
  date: string | null;
  court: string | null;
  notes: string | null;
  team1PlayerIds: [string | null, string | null];
  team2PlayerIds: [string | null, string | null];
  sitOutPlayerId: string | null;
  status: MatchStatus;
  team1Sets: number | null;
  team2Sets: number | null;
  winnerSide: MatchSide | null;
};

type MatchEditDialogProps = {
  match: MatchForEdit;
  players: PlayerOption[];
  canEdit?: boolean;
};

export function MatchEditDialog({
  match,
  players,
  canEdit = true,
}: MatchEditDialogProps) {
  if (!canEdit) {
    return null;
  }

  const defaultDateValue = toDateTimeLocalValue(match.date);
  const hasCustomCourt = Boolean(
    match.court &&
      !COURT_OPTIONS.includes(match.court as (typeof COURT_OPTIONS)[number])
  );
  const showResultFields = match.status === MatchStatus.COMPLETED;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit match</DialogTitle>
          <DialogDescription>
            Update the matchup, schedule, or notes for this fixture.
          </DialogDescription>
        </DialogHeader>
        <form action={updateMatch} className="space-y-4">
          <input type="hidden" name="matchId" value={match.id} />
          <input type="hidden" name="seasonId" value={match.seasonId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`match-${match.id}-number`}>Match number</Label>
              <Input
                id={`match-${match.id}-number`}
                name="matchNumber"
                type="number"
                min={1}
                required
                defaultValue={match.matchNumber}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`match-${match.id}-date`}>Date &amp; time</Label>
              <Input
                id={`match-${match.id}-date`}
                name="date"
                type="datetime-local"
                defaultValue={defaultDateValue}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`match-${match.id}-team1-player1`}>
                Team 1 - Player 1
              </Label>
              <select
                id={`match-${match.id}-team1-player1`}
                name="team1Player1"
                required
                defaultValue={match.team1PlayerIds[0] ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="" disabled>
                  Select a player
                </option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`match-${match.id}-team1-player2`}>
                Team 1 - Player 2
              </Label>
              <select
                id={`match-${match.id}-team1-player2`}
                name="team1Player2"
                required
                defaultValue={match.team1PlayerIds[1] ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="" disabled>
                  Select a player
                </option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`match-${match.id}-team2-player1`}>
                Team 2 - Player 1
              </Label>
              <select
                id={`match-${match.id}-team2-player1`}
                name="team2Player1"
                required
                defaultValue={match.team2PlayerIds[0] ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="" disabled>
                  Select a player
                </option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`match-${match.id}-team2-player2`}>
                Team 2 - Player 2
              </Label>
              <select
                id={`match-${match.id}-team2-player2`}
                name="team2Player2"
                required
                defaultValue={match.team2PlayerIds[1] ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="" disabled>
                  Select a player
                </option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`match-${match.id}-sitout`}>Sit out</Label>
              <select
                id={`match-${match.id}-sitout`}
                name="sitOutPlayerId"
                defaultValue={match.sitOutPlayerId ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No sit out</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`match-${match.id}-court`}>Court</Label>
              <select
                id={`match-${match.id}-court`}
                name="court"
                defaultValue={match.court ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a court</option>
                {COURT_OPTIONS.map((court) => (
                  <option key={court} value={court}>
                    {court}
                  </option>
                ))}
                {hasCustomCourt ? (
                  <option value={match.court ?? ""}>{match.court}</option>
                ) : null}
              </select>
            </div>
          </div>

          {showResultFields ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`match-${match.id}-team1-sets`}>
                  Team 1 sets
                </Label>
                <Input
                  id={`match-${match.id}-team1-sets`}
                  name="team1Sets"
                  type="number"
                  min={0}
                  max={5}
                  required
                  defaultValue={
                    typeof match.team1Sets === "number"
                      ? match.team1Sets.toString()
                      : ""
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`match-${match.id}-team2-sets`}>
                  Team 2 sets
                </Label>
                <Input
                  id={`match-${match.id}-team2-sets`}
                  name="team2Sets"
                  type="number"
                  min={0}
                  max={5}
                  required
                  defaultValue={
                    typeof match.team2Sets === "number"
                      ? match.team2Sets.toString()
                      : ""
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`match-${match.id}-winner`}>Winning team</Label>
                <select
                  id={`match-${match.id}-winner`}
                  name="winnerSide"
                  required
                  defaultValue={match.winnerSide ?? ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>
                    Select the winning team
                  </option>
                  <option value={MatchSide.TEAM1}>Team 1</option>
                  <option value={MatchSide.TEAM2}>Team 2</option>
                </select>
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor={`match-${match.id}-notes`}>Notes</Label>
            <Textarea
              id={`match-${match.id}-notes`}
              name="notes"
              rows={3}
              placeholder="Optional notes"
              defaultValue={match.notes ?? ""}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
