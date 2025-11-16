import { LeagueRole, MatchSide, MatchStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

import { canManageLeague } from "@/lib/server/league-auth";

import { removeMatchResult } from "../matches/actions";
import { MatchEditDialog } from "./match-edit-dialog";

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

function statusLabel(status: MatchStatus) {
  switch (status) {
    case MatchStatus.COMPLETED:
      return "Completed";
    case MatchStatus.IN_PROGRESS:
      return "In Progress";
    case MatchStatus.CANCELLED:
      return "Cancelled";
    default:
      return "Scheduled";
  }
}

type SchedulePageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueSchedulePage({
  params,
}: SchedulePageProps) {
  const { leagueId } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [membership, season] = await Promise.all([
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
  ]);

  if (!season) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active season found. Create a season to view the schedule.
          </p>
        </CardContent>
      </Card>
    );
  }

  const [matches, players] = await Promise.all([
    prisma.match.findMany({
      where: { seasonId: season.id },
      include: {
        player1: { select: { name: true } },
        player2: { select: { name: true } },
        player3: { select: { name: true } },
        player4: { select: { name: true } },
        sitOutPlayer: { select: { name: true } },
      },
      orderBy: { matchNumber: "asc" },
    }),
    prisma.player.findMany({
      where: { leagueId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (matches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No matches scheduled yet. Add matches to populate the schedule.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortedMatches = [...matches].sort((a, b) => {
    const aNumber = a.matchNumber ?? Number.MAX_SAFE_INTEGER;
    const bNumber = b.matchNumber ?? Number.MAX_SAFE_INTEGER;

    if (aNumber !== bNumber) {
      return aNumber - bNumber;
    }

    const aTime = a.date ? a.date.getTime() : 0;
    const bTime = b.date ? b.date.getTime() : 0;
    return aTime - bTime;
  });

  const canManageSeason = canManageLeague(
    membership?.role ?? null,
    session?.user?.systemRole,
    LeagueRole.ADMIN
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Schedule</h2>
        <p className="text-sm text-muted-foreground">
          {season.name} fixtures ordered by match number
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Full schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Court</TableHead>
                <TableHead>Team 1</TableHead>
                <TableHead>Team 2</TableHead>
                <TableHead>Sit out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="whitespace-normal">Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMatches.map((match, index) => {
                const matchNumber = match.matchNumber ?? index + 1;
                const team1 =
                  formatTeam([match.player1, match.player2]) || "Team 1";
                const team2 =
                  formatTeam([match.player3, match.player4]) || "Team 2";
                const isCompleted = match.status === MatchStatus.COMPLETED;
                const winnerName =
                  match.winnerSide === MatchSide.TEAM1
                    ? team1
                    : match.winnerSide === MatchSide.TEAM2
                    ? team2
                    : null;

                return (
                  <TableRow key={match.id}>
                    <TableCell className="font-medium">{matchNumber}</TableCell>
                    <TableCell>
                      {isCompleted && match.date
                        ? formatMatchDate(match.date)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {isCompleted && match.court ? match.court : "—"}
                    </TableCell>
                    <TableCell>{team1}</TableCell>
                    <TableCell>{team2}</TableCell>
                    <TableCell>{match.sitOutPlayer?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={isCompleted ? "secondary" : "outline"}>
                        {statusLabel(match.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isCompleted ? (
                        <div className="flex flex-col">
                          <span>{winnerName ?? "Pending"}</span>
                          <span className="text-xs text-muted-foreground">
                            {match.team1Sets ?? "-"} - {match.team2Sets ?? "-"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {match.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      {canManageSeason ? (
                        <div className="flex flex-col gap-2">
                          <MatchEditDialog
                            canEdit={canManageSeason}
                            match={{
                              id: match.id,
                              seasonId: match.seasonId,
                              matchNumber: match.matchNumber ?? index + 1,
                              date: match.date?.toISOString() ?? null,
                              court: match.court ?? null,
                              notes: match.notes ?? null,
                              team1PlayerIds: [
                                match.player1Id ?? null,
                                match.player2Id ?? null,
                              ],
                              team2PlayerIds: [
                                match.player3Id ?? null,
                                match.player4Id ?? null,
                              ],
                              sitOutPlayerId: match.sitOutPlayerId ?? null,
                              status: match.status,
                              team1Sets: match.team1Sets,
                              team2Sets: match.team2Sets,
                              winnerSide: match.winnerSide ?? null,
                            }}
                            players={players}
                          />

                          {isCompleted ? (
                            <form
                              action={removeMatchResult.bind(null, match.id)}
                            >
                              <Button variant="outline" size="sm">
                                Remove result
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
