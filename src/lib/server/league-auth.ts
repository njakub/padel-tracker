import { LeagueRole, SystemRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const leagueRolePriority: Record<LeagueRole, number> = {
  [LeagueRole.MEMBER]: 0,
  [LeagueRole.ADMIN]: 1,
  [LeagueRole.OWNER]: 2,
};

export async function requireSessionUser() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("You must be signed in to continue");
  }

  return session.user;
}

export async function requireLeagueRole(
  leagueId: string,
  minimumRole: LeagueRole = LeagueRole.ADMIN
) {
  const user = await requireSessionUser();

  if (user.systemRole === SystemRole.SUPER_ADMIN) {
    return { userId: user.id, role: LeagueRole.OWNER } as const;
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      leagueId_userId: {
        leagueId,
        userId: user.id,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    throw new Error("You are not a member of this league");
  }

  if (leagueRolePriority[membership.role] < leagueRolePriority[minimumRole]) {
    throw new Error("You do not have sufficient permissions for this action");
  }

  return { userId: user.id, role: membership.role } as const;
}

export function canManageLeague(
  membershipRole: LeagueRole | null | undefined,
  systemRole?: SystemRole,
  minimumRole: LeagueRole = LeagueRole.ADMIN
) {
  if (systemRole === SystemRole.SUPER_ADMIN) {
    return true;
  }

  if (!membershipRole) {
    return false;
  }

  return leagueRolePriority[membershipRole] >= leagueRolePriority[minimumRole];
}
