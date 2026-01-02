import Link from "next/link";
import { notFound } from "next/navigation";

import { getStandings } from "@/lib/services/standings";
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

function formatDateRange(startDate: Date, endDate?: Date | null) {
  const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  const start = formatter.format(startDate);

  if (!endDate) {
    return start;
  }

  return `${start} – ${formatter.format(endDate)}`;
}

type StandingsPageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams?: Promise<{ season?: string }>;
};

export default async function LeagueStandingsPage({
  params,
  searchParams,
}: StandingsPageProps) {
  const [{ leagueId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);

  const leagueExists = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true },
  });

  if (!leagueExists) {
    notFound();
  }

  const seasons = await prisma.season.findMany({
    where: { leagueId },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      isAdhoc: true,
      isActive: true,
    },
  });

  const requestedSeasonId = (
    resolvedSearchParams as { season?: string } | undefined
  )?.season;
  const selectedSeason =
    seasons.find((s) => s.id === requestedSeasonId) ??
    seasons.find((s) => s.isActive) ??
    seasons[0] ??
    null;

  const { season, rows, teamRows } = selectedSeason
    ? await getStandings({ seasonId: selectedSeason.id })
    : { season: null, rows: [], teamRows: [] };

  if (!season) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No seasons found. Create a season or log an ad-hoc game to get
            started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Standings</h2>
        <p className="text-sm text-muted-foreground">
          {season.name} · {formatDateRange(season.startDate, season.endDate)}
        </p>
        {seasons.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {seasons.map((s) => {
              const isSelected = s.id === season.id;
              return (
                <Link
                  key={s.id}
                  href={`/leagues/${leagueId}/standings?season=${s.id}`}
                  className={`rounded-full border px-3 py-1 transition ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-foreground hover:border-primary"
                  }`}
                >
                  <span className="font-medium">{s.name}</span>
                  {s.isAdhoc ? (
                    <span className="ml-2 text-[11px] uppercase">Ad-hoc</span>
                  ) : null}
                  {s.isActive && !s.isAdhoc ? (
                    <span className="ml-2 text-[11px] uppercase">Active</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Scoring: +1 point for every game won, plus an extra +1 for each match
        victory. Ties break on total games won, then game differential.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Player Rankings
          </CardTitle>
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
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No completed matches yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, index) => (
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
                    <TableCell className="text-right">{row.losses}</TableCell>
                    <TableCell className="text-right">
                      {row.matchesPlayed}
                    </TableCell>
                    <TableCell className="text-right">{row.gamesWon}</TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Most Effective Pairings
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-2 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-left">#</TableHead>
                <TableHead>Pairing</TableHead>
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
              {teamRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No completed doubles matches yet.
                  </TableCell>
                </TableRow>
              ) : (
                teamRows.map((row, index) => (
                  <TableRow key={row.teamKey}>
                    <TableCell className="text-left font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.teamName}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {row.points}
                    </TableCell>
                    <TableCell className="text-right">{row.wins}</TableCell>
                    <TableCell className="text-right">{row.losses}</TableCell>
                    <TableCell className="text-right">
                      {row.matchesPlayed}
                    </TableCell>
                    <TableCell className="text-right">{row.gamesWon}</TableCell>
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
    </div>
  );
}
