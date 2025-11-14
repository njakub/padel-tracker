import { AdminRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import {
  createAdminUser,
  deleteAdmin,
  updateAdminPassword,
  updateAdminSeasons,
} from "./actions";

export default async function AdminsPage() {
  const session = await auth();

  if (session?.user?.role !== AdminRole.SUPER_ADMIN) {
    redirect("/");
  }

  const [admins, seasons] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: { email: "asc" },
      include: {
        seasons: {
          select: {
            seasonId: true,
            season: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.season.findMany({ orderBy: { startDate: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin access</h1>
        <p className="text-sm text-muted-foreground">
          Invite administrators and assign them to the seasons they should
          manage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Invite an admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAdminUser} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                defaultValue={AdminRole.SEASON_ADMIN}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={AdminRole.SEASON_ADMIN}>Season admin</option>
                <option value={AdminRole.SUPER_ADMIN}>Super admin</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="seasonIds">Season access</Label>
              <select
                id="seasonIds"
                name="seasonIds"
                multiple
                className="h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Hold <kbd className="rounded border px-1">⌘</kbd> (or Ctrl on
                Windows) to select multiple seasons.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Create admin</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Existing admins
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No admin accounts yet.
            </p>
          ) : (
            admins.map((admin) => {
              const seasonAssignments = admin.seasons.map(
                (entry) => entry.season
              );
              const currentUserEmail = session.user?.email ?? null;
              const canDelete = Boolean(
                currentUserEmail && currentUserEmail !== admin.email
              );

              return (
                <div
                  key={admin.id}
                  className="space-y-4 rounded-lg border border-border/60 p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{admin.name ?? admin.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {admin.email}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {admin.role === AdminRole.SUPER_ADMIN
                        ? "Super admin"
                        : "Season admin"}
                    </p>
                  </div>

                  {admin.role === AdminRole.SEASON_ADMIN ? (
                    <form action={updateAdminSeasons} className="space-y-2">
                      <input type="hidden" name="adminId" value={admin.id} />
                      <Label htmlFor={`seasons-${admin.id}`}>
                        Season access
                      </Label>
                      <select
                        id={`seasons-${admin.id}`}
                        name="seasonIds"
                        multiple
                        defaultValue={seasonAssignments.map(
                          (season) => season.id
                        )}
                        className="h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {seasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm">
                        Update seasons
                      </Button>
                    </form>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Super admins automatically have access to every season.
                    </p>
                  )}

                  <form action={updateAdminPassword} className="space-y-2">
                    <input type="hidden" name="adminId" value={admin.id} />
                    <Label htmlFor={`password-${admin.id}`}>
                      Reset password
                    </Label>
                    <Input
                      id={`password-${admin.id}`}
                      name="password"
                      type="password"
                      minLength={8}
                      placeholder="New password"
                      required
                    />
                    <Button type="submit" size="sm" variant="outline">
                      Update password
                    </Button>
                  </form>

                  {canDelete ? (
                    <form action={deleteAdmin}>
                      <input type="hidden" name="adminId" value={admin.id} />
                      <Button type="submit" size="sm" variant="destructive">
                        Delete admin
                      </Button>
                    </form>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
