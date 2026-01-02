"use client";

import { ChangeEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { recordMatchResult } from "./actions";

type MatchOption = {
  id: string;
  label: string;
  team1Label: string;
  team2Label: string;
};

type MatchResultFormProps = {
  matches: MatchOption[];
  defaultDateValue: string;
};

export function MatchResultForm({
  matches,
  defaultDateValue,
}: MatchResultFormProps) {
  const [selectedMatchId, setSelectedMatchId] = useState("");

  const selectedMatch = matches.find((match) => match.id === selectedMatchId);

  const handleMatchChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedMatchId(event.target.value);
  };

  const team1Helper = selectedMatch?.team1Label;
  const team2Helper = selectedMatch?.team2Label;

  return (
    <form action={recordMatchResult} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="matchId">Match</Label>
        <select
          id="matchId"
          name="matchId"
          required
          value={selectedMatchId}
          onChange={handleMatchChange}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="" disabled>
            Select a scheduled match
          </option>
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              {match.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Team 1 and Team 2 follow the order configured in the schedule.
        </p>
      </div>

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
          <Label htmlFor="team1Sets" className="flex flex-col gap-0.5">
            <span>Team 1 sets</span>
            {team1Helper ? (
              <span className="text-xs text-muted-foreground">
                ({team1Helper})
              </span>
            ) : null}
          </Label>
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
          <Label htmlFor="team2Sets" className="flex flex-col gap-0.5">
            <span>Team 2 sets</span>
            {team2Helper ? (
              <span className="text-xs text-muted-foreground">
                ({team2Helper})
              </span>
            ) : null}
          </Label>
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
        <Label htmlFor="result-notes">Notes</Label>
        <Textarea
          id="result-notes"
          name="notes"
          rows={2}
          placeholder="Optional notes"
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Save result
      </Button>
    </form>
  );
}
