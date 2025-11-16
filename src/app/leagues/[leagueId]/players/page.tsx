import { LeagueRole, SkillTier } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageLeague } from "@/lib/server/league-auth";

import { createPlayer, deletePlayer } from "./actions";

type PlayersPageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeaguePlayersPage({ params }: PlayersPageProps) {
  const { leagueId } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [membership, playersRaw] = await Promise.all([
    userId
      ? prisma.leagueMembership.findUnique({
          where: { leagueId_userId: { leagueId, userId } },
          select: { role: true },
        })
      : Promise.resolve(null),
    prisma.player.findMany({
      where: { leagueId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        skillTier: true,
        createdAt: true,
      },
    }),
  ]);

  const players = playersRaw as Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    skillTier: SkillTier;
    createdAt: Date;
  }>;

  const canManage = canManageLeague(
    membership?.role ?? null,
    session?.user?.systemRole,
    LeagueRole.ADMIN
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Players</h2>
          <p className="text-sm text-muted-foreground">
            Manage the roster available to this league.
          </p>
        </div>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Add player
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPlayer} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="leagueId" value={leagueId} />
              <div className="space-y-2">
                <Label htmlFor="player-name">Name</Label>
                <Input id="player-name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-email">Email</Label>
                <Input id="player-email" name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-phone">Phone</Label>
                <Input id="player-phone" name="phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-tier">Skill tier</Label>
                <Select name="skillTier" defaultValue={SkillTier.INTERMEDIATE}>
                  <SelectTrigger id="player-tier">
                    <SelectValue placeholder="Select a tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(SkillTier).map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier.charAt(0) + tier.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Add player</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Roster</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No players added yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-base font-medium">{player.name}</p>
                    <div className="text-xs text-muted-foreground">
                      <span>{player.skillTier}</span>
                      {player.email ? <span> • {player.email}</span> : null}
                      {player.phone ? <span> • {player.phone}</span> : null}
                    </div>
                  </div>
                  {canManage ? (
                    <form
                      action={async () => {
                        "use server";
                        await deletePlayer(player.id, leagueId);
                      }}
                    >
                      <Button variant="outline" size="sm">
                        Remove
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
  );
}
