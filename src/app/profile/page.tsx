import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { MembershipCard } from "./membership-card";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Sign in to manage your leagues.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const membershipsRaw = await prisma.leagueMembership.findMany({
    where: { userId: session.user.id },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          players: {
            select: {
              id: true,
              name: true,
            },
            orderBy: { name: "asc" },
          },
        },
      },
      player: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const memberships = membershipsRaw as Array<{
    id: string;
    role: string;
    league: {
      id: string;
      name: string;
      players: Array<{ id: string; name: string }>;
    };
    player: { id: string; name: string } | null;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your league memberships and player mappings.
        </p>
      </div>

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              You have not joined any leagues yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {memberships.map((membership) => (
            <MembershipCard
              key={membership.id}
              membershipId={membership.id}
              role={membership.role}
              league={{
                id: membership.league.id,
                name: membership.league.name,
              }}
              players={membership.league.players}
              linkedPlayer={membership.player}
            />
          ))}
        </div>
      )}
    </div>
  );
}
