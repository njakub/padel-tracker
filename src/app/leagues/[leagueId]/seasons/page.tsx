import { LeagueRole } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageLeague } from "@/lib/server/league-auth";

import { closeSeason, createSeason, setActiveSeason } from "./actions";

function formatDateRange(start: Date, end?: Date | null) {
  const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  const startText = formatter.format(start);
  if (!end) return startText;
  return `${startText} – ${formatter.format(end)}`;
}

type SeasonsPageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueSeasonsPage({ params }: SeasonsPageProps) {
  const { leagueId } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [membership, seasonsRaw] = await Promise.all([
    userId
      ? prisma.leagueMembership.findUnique({
          where: { leagueId_userId: { leagueId, userId } },
          select: { role: true },
        })
      : Promise.resolve(null),
    prisma.season.findMany({
      where: { leagueId },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const seasons = seasonsRaw as Array<{
    id: string;
    name: string;
    startDate: Date;
    endDate: Date | null;
    description: string | null;
    isActive: boolean;
  }>;

  const canManage = canManageLeague(
    membership?.role ?? null,
    session?.user?.systemRole,
    LeagueRole.ADMIN
  );

  const activeSeason = seasons.find((season) => season.isActive) ?? null;
  const pastSeasons = seasons.filter((season) => !season.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Seasons</h2>
          <p className="text-sm text-muted-foreground">
            Track active and historical seasons for this league.
          </p>
        </div>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Create a season
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createSeason} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="leagueId" value={leagueId} />
              <input
                type="hidden"
                name="scheduleType"
                value="PARTNER_BALANCED_5P"
              />
              <div className="space-y-2">
                <Label htmlFor="season-name">Name</Label>
                <Input id="season-name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="season-start">Start date</Label>
                <Input
                  id="season-start"
                  name="startDate"
                  type="date"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Auto-generate schedule</Label>
                <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="generate-schedule"
                      name="generateSchedule"
                      defaultChecked
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="generate-schedule"
                        className="cursor-pointer"
                      >
                        Create a partner-balanced schedule (5 players)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Every player pairing will be teammates an equal number
                        of times. Requires the league to have exactly 5 players.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="season-length">
                        Season length (matches)
                      </Label>
                      <select
                        id="season-length"
                        name="seasonLengthMatches"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        defaultValue="30"
                      >
                        {[5, 10, 15, 20, 25, 30, 35, 40, 45].map((len) => (
                          <option key={len} value={len}>
                            {len} matches (each pair together {len / 5}×)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="season-end">End date</Label>
                <Input id="season-end" name="endDate" type="date" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="season-description">Description</Label>
                <Textarea
                  id="season-description"
                  name="description"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Create &amp; activate</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Active season
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSeason ? (
              <div className="space-y-2">
                <div>
                  <h3 className="text-lg font-semibold">{activeSeason.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDateRange(
                      activeSeason.startDate,
                      activeSeason.endDate
                    )}
                  </p>
                </div>
                {activeSeason.description ? (
                  <p className="text-sm text-muted-foreground">
                    {activeSeason.description}
                  </p>
                ) : null}
                {canManage ? (
                  <form
                    action={async () => {
                      "use server";
                      await closeSeason(activeSeason.id, leagueId);
                    }}
                  >
                    <Button variant="outline" size="sm">
                      Mark as completed
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active season selected.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Season history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pastSeasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No completed seasons yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {pastSeasons.map((season) => (
                  <li
                    key={season.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-medium">{season.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(season.startDate, season.endDate)}
                      </p>
                    </div>
                    {canManage ? (
                      <form
                        action={async () => {
                          "use server";
                          await setActiveSeason(season.id, leagueId);
                        }}
                      >
                        <Button size="sm" variant="ghost">
                          Set as active
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
