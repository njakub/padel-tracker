"use server";

import { LeagueRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireLeagueRole } from "@/lib/server/league-auth";
import { generatePartnerBalanced5PlayerDoublesFixtures } from "@/lib/services/fixture-generator";

const seasonSchema = z.object({
  leagueId: z.string().min(1),
  name: z.string().trim().min(1, "Season name is required").max(100),
  startDate: z.preprocess((v) => {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (!trimmed) return undefined;
      return new Date(trimmed);
    }
    return v;
  }, z.date({ message: "Start date is required" })),
  endDate: z.preprocess((v) => {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (!trimmed) return undefined;
      return new Date(trimmed);
    }
    return v;
  }, z.date().optional()),
  description: z.string().trim().max(500).optional(),
  generateSchedule: z.coerce.boolean().optional(),
  scheduleType: z.enum(["PARTNER_BALANCED_5P"]).optional(),
  seasonLengthMatches: z.coerce.number().int().positive().optional(),
});

function revalidateLeagueSeasonViews(leagueId: string) {
  revalidatePath(`/leagues/${leagueId}/standings`);
  revalidatePath(`/leagues/${leagueId}/schedule`);
  revalidatePath(`/leagues/${leagueId}/matches`);
  revalidatePath(`/leagues/${leagueId}/seasons`);
}

export async function createSeason(formData: FormData) {
  const parsed = seasonSchema.safeParse({
    leagueId: formData.get("leagueId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    startDate: formData.get("startDate")?.toString() ?? "",
    endDate: formData.get("endDate")?.toString() ?? undefined,
    description: formData.get("description")?.toString() ?? undefined,
    generateSchedule: formData.get("generateSchedule")?.toString() ?? undefined,
    scheduleType: formData.get("scheduleType")?.toString() ?? undefined,
    seasonLengthMatches:
      formData.get("seasonLengthMatches")?.toString() ?? undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid season data");
  }

  const data = parsed.data;

  const allowedLengths = [5, 10, 15, 20, 25, 30, 35, 40, 45];

  await requireLeagueRole(data.leagueId, LeagueRole.ADMIN);

  await prisma.$transaction(async (tx) => {
    await tx.season.updateMany({
      where: { leagueId: data.leagueId, isActive: true },
      data: { isActive: false },
    });

    const createdSeason = await tx.season.create({
      data: {
        leagueId: data.leagueId,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        description: data.description,
        isActive: true,
      },
    });

    // FormData booleans are tricky; treat "on"/"true" as true.
    const generateSchedule =
      formData.get("generateSchedule")?.toString() === "on" ||
      formData.get("generateSchedule")?.toString() === "true";

    if (!generateSchedule) {
      return;
    }

    if (data.scheduleType !== "PARTNER_BALANCED_5P") {
      throw new Error("Unsupported schedule type");
    }

    const seasonLengthMatches = data.seasonLengthMatches ?? 30;
    if (!allowedLengths.includes(seasonLengthMatches)) {
      throw new Error(
        `Season length must be one of: ${allowedLengths.join(", ")}`
      );
    }

    const leaguePlayers = await tx.player.findMany({
      where: { leagueId: data.leagueId },
      orderBy: { name: "asc" },
      select: { id: true },
      take: 5,
    });

    if (leaguePlayers.length !== 5) {
      throw new Error(
        `Schedule generation requires exactly 5 players in the league (found ${leaguePlayers.length}).`
      );
    }

    const playerIds = leaguePlayers.map((p) => p.id) as [
      string,
      string,
      string,
      string,
      string
    ];

    const fixtures = generatePartnerBalanced5PlayerDoublesFixtures({
      playerIds,
      seasonLengthMatches,
    });

    const courtNames = ["Center Court", "Court 1", "Court 2"];

    await tx.match.createMany({
      data: fixtures.map((fixture) => {
        const matchDate = new Date(data.startDate);
        matchDate.setDate(
          data.startDate.getDate() + (fixture.matchNumber - 1) * 7
        );

        return {
          seasonId: createdSeason.id,
          matchNumber: fixture.matchNumber,
          date: matchDate,
          court: courtNames[(fixture.matchNumber - 1) % courtNames.length],
          isDoubles: true,
          sitOutPlayerId: fixture.sitOut,
          player1Id: fixture.team1[0],
          player2Id: fixture.team1[1],
          player3Id: fixture.team2[0],
          player4Id: fixture.team2[1],
          status: fixture.matchNumber === 1 ? "SCHEDULED" : "SCHEDULED",
        };
      }),
    });
  });

  revalidateLeagueSeasonViews(data.leagueId);
}

export async function setActiveSeason(seasonId: string, leagueId: string) {
  await requireLeagueRole(leagueId, LeagueRole.ADMIN);

  await prisma.$transaction(async (tx) => {
    await tx.season.updateMany({
      where: { leagueId },
      data: { isActive: false },
    });

    await tx.season.update({
      where: { id: seasonId },
      data: { isActive: true },
    });
  });

  revalidateLeagueSeasonViews(leagueId);
}

export async function closeSeason(seasonId: string, leagueId: string) {
  await requireLeagueRole(leagueId, LeagueRole.ADMIN);

  await prisma.season.update({
    where: { id: seasonId },
    data: {
      isActive: false,
      endDate: new Date(),
    },
  });

  revalidateLeagueSeasonViews(leagueId);
}
