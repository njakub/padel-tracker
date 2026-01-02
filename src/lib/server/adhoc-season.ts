import { prisma } from "@/lib/prisma";

const ADHOC_SEASON_NAME = "Ad hoc Games";

/**
 * Ensures a per-league ad-hoc season exists and returns its ID.
 * Ad-hoc seasons remain inactive to avoid clashing with scheduled seasons.
 */
export async function getOrCreateAdhocSeason(leagueId: string) {
  const existing = await prisma.season.findFirst({
    where: { leagueId, isAdhoc: true },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const now = new Date();

  const created = await prisma.season.create({
    data: {
      leagueId,
      name: ADHOC_SEASON_NAME,
      startDate: now,
      isActive: false,
      isAdhoc: true,
      description: "Unscheduled matches recorded on demand",
    },
    select: { id: true },
  });

  return created.id;
}
