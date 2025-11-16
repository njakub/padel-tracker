import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeagueRole, SystemRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const rolePriority: Record<LeagueRole, number> = {
  [LeagueRole.MEMBER]: 0,
  [LeagueRole.ADMIN]: 1,
  [LeagueRole.OWNER]: 2,
};

const leagueNav = [
  { href: "standings", label: "Standings" },
  { href: "schedule", label: "Schedule" },
  { href: "matches", label: "Matches" },
  { href: "players", label: "Players", minRole: LeagueRole.ADMIN },
  { href: "seasons", label: "Seasons", minRole: LeagueRole.ADMIN },
  { href: "settings", label: "Settings", minRole: LeagueRole.ADMIN },
];

function roleLabel(role: LeagueRole) {
  switch (role) {
    case LeagueRole.OWNER:
      return "Owner";
    case LeagueRole.ADMIN:
      return "Admin";
    default:
      return "Member";
  }
}

type LeagueLayoutProps = {
  children: ReactNode;
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueLayout({
  children,
  params,
}: LeagueLayoutProps) {
  const { leagueId } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [league, membership] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, name: true },
    }),
    userId
      ? prisma.leagueMembership.findUnique({
          where: { leagueId_userId: { leagueId, userId } },
          select: { role: true },
        })
      : Promise.resolve(null),
  ]);

  if (!league) {
    notFound();
  }

  const userRole = membership?.role;
  const isSuperAdmin = session?.user?.systemRole === SystemRole.SUPER_ADMIN;

  const availableLinks = leagueNav.filter(({ minRole }) => {
    if (!minRole) {
      return true;
    }

    if (isSuperAdmin) {
      return true;
    }

    if (!userRole) {
      return false;
    }

    return rolePriority[userRole] >= rolePriority[minRole];
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{league.name}</h1>
            <p className="text-sm text-muted-foreground">
              {userRole
                ? `You are an ${roleLabel(userRole)} of this league.`
                : isSuperAdmin
                ? "Viewing as super admin."
                : session?.user
                ? "Viewing as a signed-in guest."
                : "Viewing as guest. Sign in to manage this league."}
            </p>
          </div>
          <Link
            href="/leagues"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            All leagues
          </Link>
        </div>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
          {availableLinks.map((link) => (
            <Link
              key={link.href}
              href={`/leagues/${league.id}/${link.href}`}
              className="rounded-full border border-transparent px-4 py-2 text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <section>{children}</section>
    </div>
  );
}
