"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { recordAdhocMatch } from "./actions";

type PlayerOption = { id: string; name: string | null };

type AdhocMatchFormProps = {
  leagueId: string;
  players: PlayerOption[];
  defaultDateValue: string;
};

export function AdhocMatchForm({
  leagueId,
  players,
  defaultDateValue,
}: AdhocMatchFormProps) {
  const [team1P1, setTeam1P1] = useState(() => players[0]?.id ?? "");
  const [team1P2, setTeam1P2] = useState(() => players[1]?.id ?? "");
  const [team2P1, setTeam2P1] = useState(() => players[2]?.id ?? "");
  const [team2P2, setTeam2P2] = useState(() => players[3]?.id ?? "");

  const selected = useMemo(
    () => new Set([team1P1, team1P2, team2P1, team2P2].filter(Boolean)),
    [team1P1, team1P2, team2P1, team2P2]
  );

  const renderOptions = (currentValue: string) =>
    players.map((player) => (
      <option
        key={player.id}
        value={player.id}
        disabled={selected.has(player.id) && player.id !== currentValue}
      >
        {player.name}
      </option>
    ));

  return (
    <form action={recordAdhocMatch} className="space-y-4">
      <input type="hidden" name="leagueId" value={leagueId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="playedAt">Date &amp; time</Label>
          <Input
            id="playedAt"
            name="playedAt"
            type="datetime-local"
            defaultValue={defaultDateValue}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="court">Court</Label>
          <select
            id="court"
            name="court"
            required
            defaultValue=""
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              Select a court
            </option>
            <option value="The Padel Hub - Reading">
              The Padel Hub - Reading
            </option>
            <option value="The Atrium">The Atrium</option>
            <option value="PadelStars Reading">PadelStars Reading</option>
            <option value="PadelStars Bracknell">PadelStars Bracknell</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="team1Player1">Team 1 - Player 1</Label>
          <select
            id="team1Player1"
            name="team1Player1"
            required
            value={team1P1}
            onChange={(e) => setTeam1P1(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              Select player
            </option>
            {renderOptions(team1P1)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="team1Player2">Team 1 - Player 2</Label>
          <select
            id="team1Player2"
            name="team1Player2"
            required
            value={team1P2}
            onChange={(e) => setTeam1P2(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              Select player
            </option>
            {renderOptions(team1P2)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="team2Player1">Team 2 - Player 1</Label>
          <select
            id="team2Player1"
            name="team2Player1"
            required
            value={team2P1}
            onChange={(e) => setTeam2P1(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              Select player
            </option>
            {renderOptions(team2P1)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="team2Player2">Team 2 - Player 2</Label>
          <select
            id="team2Player2"
            name="team2Player2"
            required
            value={team2P2}
            onChange={(e) => setTeam2P2(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              Select player
            </option>
            {renderOptions(team2P2)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="team1Sets">Team 1 sets</Label>
          <Input
            id="team1Sets"
            name="team1Sets"
            type="number"
            min={0}
            max={5}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="team2Sets">Team 2 sets</Label>
          <Input
            id="team2Sets"
            name="team2Sets"
            type="number"
            min={0}
            max={5}
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Optional notes"
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Save ad-hoc match
      </Button>
    </form>
  );
}
