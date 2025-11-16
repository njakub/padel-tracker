import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { acceptInvitation } from "../actions";

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinLeaguePage({ params }: JoinPageProps) {
  const { token } = await params;
  const session = await auth();

  const invitation = await prisma.leagueInvitation.findUnique({
    where: { token },
    include: {
      invitedBy: { select: { name: true, email: true } },
      league: {
        select: {
          id: true,
          name: true,
          players: {
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });

  if (!invitation || invitation.acceptedAt) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              This invitation is no longer valid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Join {invitation.league.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in to accept this invitation.
            </p>
            <Link href={`/sign-in?redirectTo=/join/${token}`}>
              <Button>Sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const players = invitation.league.players as Array<{
    id: string;
    name: string;
  }>;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Join {invitation.league.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Invited by {invitation.invitedBy.name ?? invitation.invitedBy.email}
          </p>
          <form action={acceptInvitation} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <div className="space-y-1.5">
              <Label htmlFor="playerId">
                Link to existing player (optional)
              </Label>
              <Select name="playerId" defaultValue="">
                <SelectTrigger id="playerId">
                  <SelectValue placeholder="Select a player" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No linked player</SelectItem>
                  {players.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the roster entry that represents you, or leave blank to
                create a new player later.
              </p>
            </div>
            <Button type="submit" className="w-full">
              Accept invitation
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
