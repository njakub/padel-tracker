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

function formatDateRange(startDate: Date, endDate?: Date | null) {
  const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  const start = formatter.format(startDate);

  if (!endDate) {
    return start;
  }

  return `${start} – ${formatter.format(endDate)}`;
}

export default async function StandingsPage() {
  const { season, rows } = await getStandings();

  if (!season) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active season found. Create a season and add a match to get
            started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Standings</h1>
        <p className="text-sm text-muted-foreground">
          {season.name} · {formatDateRange(season.startDate, season.endDate)}
        </p>
      </div>

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
                <TableHead className="text-right">Sets +</TableHead>
                <TableHead className="text-right">Sets -</TableHead>
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
                    <TableCell className="text-right">{row.setsWon}</TableCell>
                    <TableCell className="text-right">{row.setsLost}</TableCell>
                    <TableCell className="text-right">
                      {row.setDifferential >= 0 ? "+" : ""}
                      {row.setDifferential}
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
