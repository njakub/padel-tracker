import Link from "next/link";
import { LeagueRole, SystemRole } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const roleLabel: Record<LeagueRole, string> = {
  [LeagueRole.MEMBER]: "Member",
  [LeagueRole.ADMIN]: "Admin",
  [LeagueRole.OWNER]: "Owner",
};

export default async function LeaguesPage() {
  const session = await auth();
  const userId = session?.user?.id ?? "";
  const isSuperAdmin = session?.user?.systemRole === SystemRole.SUPER_ADMIN;

  const leagues = await prisma.league.findMany({
    orderBy: { name: "asc" },
    include: {
      seasons: {
        where: { isActive: true },
        orderBy: { startDate: "desc" },
        select: { id: true, name: true },
        take: 1,
      },
      memberships: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
      _count: {
        select: {
          memberships: true,
          players: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leagues</h1>
        <p className="text-sm text-muted-foreground">
          Browse public standings and schedules, or sign in to manage leagues
          you belong to.
        </p>
      </div>

      {leagues.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              No leagues yet
            </CardTitle>
            <CardDescription>
              Create the first league once you are signed in.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leagues.map((league) => {
            const membership = league.memberships[0] ?? null;
            const activeSeason = league.seasons[0] ?? null;
            const membershipCopy = membership
              ? `Your role: ${roleLabel[membership.role]}`
              : isSuperAdmin
              ? "Viewing as super admin."
              : session?.user
              ? "You are not yet a member. Ask an admin for an invite."
              : "Viewing as guest. Sign in or use an invite link to join.";

            return (
              <Card key={league.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{league.name}</CardTitle>
                  <CardDescription>
                    {activeSeason
                      ? `Active season: ${activeSeason.name}`
                      : "No active season."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pb-6">
                  <p className="text-sm text-muted-foreground">
                    Players: {league._count.players} • Members:{" "}
                    {league._count.memberships}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {membershipCopy}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/leagues/${league.id}/standings`}>
                        Standings
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/leagues/${league.id}/schedule`}>
                        Schedule
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/leagues/${league.id}/matches`}>
                        Matches
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
