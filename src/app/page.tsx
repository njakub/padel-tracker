import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/services/standings";

type LandingTarget = {
  leagueId: string;
  leagueName: string;
  reason: "membership" | "membership-no-active" | "global";
  seasonId?: string;
};

function formatDateRange(startDate: Date, endDate?: Date | null) {
  const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  const start = formatter.format(startDate);

  if (!endDate) {
    return start;
  }

  return `${start} – ${formatter.format(endDate)}`;
}

export default async function LandingPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  let target: LandingTarget | null = null;

  if (userId) {
    const membershipWithActiveSeason = await prisma.leagueMembership.findFirst({
      where: {
        userId,
        league: { seasons: { some: { isActive: true } } },
      },
      include: {
        league: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (membershipWithActiveSeason) {
      target = {
        leagueId: membershipWithActiveSeason.league.id,
        leagueName: membershipWithActiveSeason.league.name,
        reason: "membership",
      } as const;
    } else {
      const fallbackMembership = await prisma.leagueMembership.findFirst({
        where: { userId },
        include: {
          league: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      if (fallbackMembership) {
        target = {
          leagueId: fallbackMembership.league.id,
          leagueName: fallbackMembership.league.name,
          reason: "membership-no-active",
        } as const;
      }
    }
  }

  if (!target) {
    const busiestSeason = await prisma.season.findFirst({
      where: { isActive: true },
      include: {
        league: { select: { id: true, name: true } },
      },
      orderBy: [{ matches: { _count: "desc" } }, { startDate: "desc" }],
    });

    if (busiestSeason) {
      target = {
        leagueId: busiestSeason.league.id,
        leagueName: busiestSeason.league.name,
        reason: "global",
        seasonId: busiestSeason.id,
      } as const;
    }
  }

  const standings = target
    ? await getStandings(
        target.seasonId
          ? { seasonId: target.seasonId }
          : { leagueId: target.leagueId }
      )
    : { season: null, rows: [] };

  const season = standings.season;

  let introLine =
    "No leagues available yet. Create your first league to get started.";

  if (target) {
    if (target.reason === "membership") {
      introLine = `Showing standings from ${target.leagueName}, one of your leagues.`;
    } else if (target.reason === "membership-no-active") {
      introLine = `You are a member of ${target.leagueName}. Activate a season to see live standings.`;
    } else {
      introLine = `${target.leagueName} is currently the busiest league in the system.`;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Padel Tracker
          </h1>
          <p className="text-sm text-muted-foreground">{introLine}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/leagues">Browse leagues</Link>
          </Button>
          {session?.user ? (
            <Button asChild>
              <Link href="/profile">Go to profile</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </div>

      {season ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{target?.leagueName}</h2>
            <p className="text-sm text-muted-foreground">
              {season.name} ·{" "}
              {formatDateRange(season.startDate, season.endDate)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Scoring: +1 point per game won and an extra +1 for each match
            victory. Ties break on total games won, then game differential.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Player Rankings
              </CardTitle>
              {target ? (
                <CardAction>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/leagues/${target.leagueId}/standings`}>
                      View league
                    </Link>
                  </Button>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="overflow-x-auto px-2 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-left">#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">Pts</TableHead>
                    <TableHead className="text-right">W</TableHead>
                    <TableHead className="text-right">L</TableHead>
                    <TableHead className="text-right">MP</TableHead>
                    <TableHead className="text-right">Games +</TableHead>
                    <TableHead className="text-right">Games -</TableHead>
                    <TableHead className="text-right">Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No completed matches yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    standings.rows.map((row, index) => (
                      <TableRow key={row.playerId}>
                        <TableCell className="text-left font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.playerName}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.points}
                        </TableCell>
                        <TableCell className="text-right">{row.wins}</TableCell>
                        <TableCell className="text-right">
                          {row.losses}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.matchesPlayed}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.gamesWon}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.gamesLost}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.gameDifferential >= 0 ? "+" : ""}
                          {row.gameDifferential}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      ) : target ? (
        <Card>
          <CardHeader>
            <CardTitle>Standings unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              There is no active season in {target.leagueName} yet. Once a
              season starts and matches are recorded, standings will appear
              here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Padel Tracker</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create a league to start scheduling matches and tracking results.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
