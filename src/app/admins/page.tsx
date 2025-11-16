import { SystemRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createAdminUser, deleteAdmin, updateAdminPassword } from "./actions";

export default async function AdminsPage() {
  const session = await auth();

  if (session?.user?.systemRole !== SystemRole.SUPER_ADMIN) {
    redirect("/");
  }

  const admins = await prisma.user.findMany({
    where: { systemRole: SystemRole.SUPER_ADMIN },
    orderBy: { email: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin access</h1>
        <p className="text-sm text-muted-foreground">
          Manage super administrators who have full access across all leagues.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Add a super admin
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
            <div className="sm:col-span-2">
              <Button type="submit">Create super admin</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Super admins
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No admin accounts yet.
            </p>
          ) : (
            admins.map((admin) => {
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
                      Super admin
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Super admins automatically have access to every league and
                    season.
                  </p>

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
                        Remove super admin
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
