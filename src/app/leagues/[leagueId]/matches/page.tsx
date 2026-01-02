import { LeagueRole, MatchSide, MatchStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

import { canManageLeague } from "@/lib/server/league-auth";

import { deleteMatch, removeMatchResult } from "./actions";
import { AdhocMatchForm } from "./adhoc-match-form";
import { MatchResultForm } from "./match-result-form";

function toDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatMatchDate(date?: Date | null) {
  if (!date) {
    return "Not recorded";
  }
  return dateFormatter.format(date);
}

function formatTeam(
  members: Array<{ name: string | null | undefined } | null | undefined>
) {
  return members
    .map((player) => player?.name)
    .filter(Boolean)
    .join(" & ");
}

type MatchesPageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueMatchesPage({ params }: MatchesPageProps) {
  const { leagueId } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [membership, season, adhocSeason, players] = await Promise.all([
    userId
      ? prisma.leagueMembership.findUnique({
          where: { leagueId_userId: { leagueId, userId } },
          select: { role: true },
        })
      : Promise.resolve(null),
    prisma.season.findFirst({
      where: { leagueId, isActive: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.season.findFirst({
      where: { leagueId, isAdhoc: true },
      select: { id: true, name: true },
    }),
    prisma.player.findMany({
      where: { leagueId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const [matches, adhocMatches] = await Promise.all([
    season
      ? prisma.match.findMany({
          where: { seasonId: season.id },
          include: {
            player1: { select: { id: true, name: true } },
            player2: { select: { id: true, name: true } },
            player3: { select: { id: true, name: true } },
            player4: { select: { id: true, name: true } },
            sitOutPlayer: { select: { id: true, name: true } },
          },
          orderBy: [{ status: "asc" }, { matchNumber: "asc" }],
        })
      : Promise.resolve([]),
    adhocSeason
      ? prisma.match.findMany({
          where: { seasonId: adhocSeason.id },
          include: {
            player1: { select: { id: true, name: true } },
            player2: { select: { id: true, name: true } },
            player3: { select: { id: true, name: true } },
            player4: { select: { id: true, name: true } },
          },
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
  ]);

  const isLeagueManager = canManageLeague(
    membership?.role ?? null,
    session?.user?.systemRole,
    LeagueRole.ADMIN
  );

  const scheduledMatches = season
    ? matches
        .filter((match) => match.status !== MatchStatus.COMPLETED)
        .sort(
          (a, b) =>
            (a.matchNumber ?? Number.MAX_SAFE_INTEGER) -
            (b.matchNumber ?? Number.MAX_SAFE_INTEGER)
        )
    : [];

  const completedMatches = season
    ? matches
        .filter((match) => match.status === MatchStatus.COMPLETED)
        .sort((a, b) => (b.matchNumber ?? 0) - (a.matchNumber ?? 0))
    : [];

  const defaultDateValue = toDateTimeLocalValue(new Date());
  const matchOptions = scheduledMatches.map((match) => {
    const team1 = formatTeam([match.player1, match.player2]) || "Team 1";
    const team2 = formatTeam([match.player3, match.player4]) || "Team 2";

    return {
      id: match.id,
      label: `Match ${match.matchNumber ?? "?"} • ${team1} vs ${team2}`,
      team1Label: team1,
      team2Label: team2,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Matches</h2>
        <p className="text-sm text-muted-foreground">
          {season
            ? `Manage fixtures and record results for ${season.name}`
            : "No active season found. You can still log ad-hoc games."}
        </p>
      </div>

      {season ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Log a Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduledMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All scheduled matches are up to date. Create a new match or
                reopen one to log a result.
              </p>
            ) : isLeagueManager ? (
              <MatchResultForm
                matches={matchOptions}
                defaultDateValue={defaultDateValue}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Admin access is required to record match results.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Log an Ad-hoc Game
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLeagueManager ? (
            players.length >= 4 ? (
              <AdhocMatchForm
                leagueId={leagueId}
                players={players}
                defaultDateValue={defaultDateValue}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Need at least 4 players in the league to record an ad-hoc game.
              </p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Admin access is required to record ad-hoc games.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Completed</h3>
        {completedMatches.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              {season
                ? "No completed matches yet."
                : "No active season. Scheduled matches will appear here when available."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {completedMatches.map((match) => {
              const team1 =
                formatTeam([match.player1, match.player2]) || "Team 1";
              const team2 =
                formatTeam([match.player3, match.player4]) || "Team 2";
              const winnerName =
                match.winnerSide === MatchSide.TEAM1
                  ? team1
                  : match.winnerSide === MatchSide.TEAM2
                  ? team2
                  : null;

              return (
                <Card key={match.id}>
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Match {match.matchNumber}</span>
                      <span>{formatMatchDate(match.date)}</span>
                    </div>
                    <CardTitle className="text-lg">
                      {team1} vs {team2}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">
                        Winner: {winnerName ?? "Pending"}
                      </Badge>
                      <span className="text-muted-foreground">
                        {match.team1Sets} - {match.team2Sets}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {match.court ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Court</span>
                        <span>{match.court}</span>
                      </div>
                    ) : null}
                    {match.notes ? (
                      <p className="text-sm text-muted-foreground">
                        {match.notes}
                      </p>
                    ) : null}
                    {isLeagueManager ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={removeMatchResult.bind(null, match.id)}>
                          <Button type="submit" variant="secondary" size="sm">
                            Remove result
                          </Button>
                        </form>
                        <form action={deleteMatch.bind(null, match.id)}>
                          <Button type="submit" variant="destructive" size="sm">
                            Delete match
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Ad-hoc Games</h3>
        {adhocMatches.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No ad-hoc games recorded yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {adhocMatches.map((match, index) => {
              const team1 =
                formatTeam([match.player1, match.player2]) || "Team 1";
              const team2 =
                formatTeam([match.player3, match.player4]) || "Team 2";
              const winnerName =
                match.winnerSide === MatchSide.TEAM1
                  ? team1
                  : match.winnerSide === MatchSide.TEAM2
                  ? team2
                  : null;

              return (
                <Card key={match.id}>
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Ad-hoc #{match.matchNumber ?? index + 1}</span>
                      <span>{formatMatchDate(match.date)}</span>
                    </div>
                    <CardTitle className="text-lg">
                      {team1} vs {team2}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">
                        Winner: {winnerName ?? "Pending"}
                      </Badge>
                      <span className="text-muted-foreground">
                        {match.team1Sets} - {match.team2Sets}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {match.court ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Court</span>
                        <span>{match.court}</span>
                      </div>
                    ) : null}
                    {match.notes ? (
                      <p className="text-sm text-muted-foreground">
                        {match.notes}
                      </p>
                    ) : null}
                    {isLeagueManager ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={deleteMatch.bind(null, match.id)}>
                          <Button type="submit" variant="destructive" size="sm">
                            Delete ad-hoc game
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
