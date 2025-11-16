import { LeagueRole } from "@prisma/client";

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

import { createInvitation, revokeInvitation } from "./actions";

const roleLabel: Record<LeagueRole, string> = {
  [LeagueRole.MEMBER]: "Member",
  [LeagueRole.ADMIN]: "Admin",
  [LeagueRole.OWNER]: "Owner",
};

type SettingsPageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueSettingsPage({
  params,
}: SettingsPageProps) {
  const { leagueId } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [membership, membersRaw, invitationsRaw] = await Promise.all([
    userId
      ? prisma.leagueMembership.findUnique({
          where: { leagueId_userId: { leagueId, userId } },
          select: { role: true },
        })
      : Promise.resolve(null),
    prisma.leagueMembership.findMany({
      where: { leagueId },
      include: {
        user: { select: { name: true, email: true } },
        player: { select: { name: true } },
      },
      orderBy: { role: "desc" },
    }),
    prisma.leagueInvitation.findMany({
      where: { leagueId },
      orderBy: { createdAt: "desc" },
      include: {
        invitedBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  const members = membersRaw as Array<{
    id: string;
    role: LeagueRole;
    user: { name: string | null; email: string | null } | null;
    player: { name: string | null } | null;
  }>;

  const invitations = invitationsRaw as Array<{
    id: string;
    token: string;
    role: LeagueRole;
    invitedEmail: string | null;
    invitedBy: { name: string | null; email: string | null };
  }>;

  const canManage = canManageLeague(
    membership?.role ?? null,
    session?.user?.systemRole,
    LeagueRole.ADMIN
  );

  const host = process.env.AUTH_URL?.replace(/\/$/, "") ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">League settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage admins, invitations, and member roles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="space-y-3">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-1 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-base font-medium">
                      {member.user?.name ??
                        member.user?.email ??
                        "Unknown user"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabel[member.role]}
                      {member.player?.name
                        ? ` • Player: ${member.player.name}`
                        : ""}
                    </p>
                  </div>
                  {/* Future: role management */}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Invitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage ? (
            <form
              action={createInvitation}
              className="grid gap-4 sm:grid-cols-2"
            >
              <input type="hidden" name="leagueId" value={leagueId} />
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email (optional)</Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="Invitee email"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to generate a shareable invite link.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select name="role" defaultValue={LeagueRole.ADMIN}>
                  <SelectTrigger id="invite-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {[LeagueRole.ADMIN, LeagueRole.MEMBER].map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabel[role]}
                      </SelectItem>
                    ))}
                    {membership?.role === LeagueRole.OWNER ? (
                      <SelectItem value={LeagueRole.OWNER}>
                        {roleLabel[LeagueRole.OWNER]}
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Create invitation</Button>
              </div>
            </form>
          ) : null}

          <div className="space-y-3">
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending invitations.
              </p>
            ) : (
              <ul className="space-y-3">
                {invitations.map((invite) => {
                  const inviteUrl = host
                    ? `${host}/join/${invite.token}`
                    : `/join/${invite.token}`;

                  return (
                    <li
                      key={invite.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/60 p-4"
                    >
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          Role: {roleLabel[invite.role]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Invited by{" "}
                          {invite.invitedBy.name ?? invite.invitedBy.email}
                        </p>
                        {invite.invitedEmail ? (
                          <p className="text-xs text-muted-foreground">
                            Email: {invite.invitedEmail}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Input
                          readOnly
                          value={inviteUrl}
                          className="sm:max-w-md"
                        />
                        {canManage ? (
                          <form
                            action={async () => {
                              "use server";
                              await revokeInvitation(invite.id, leagueId);
                            }}
                          >
                            <Button type="submit" variant="outline" size="sm">
                              Revoke
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
