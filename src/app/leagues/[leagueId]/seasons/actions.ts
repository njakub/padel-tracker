"use server";

import { LeagueRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireLeagueRole } from "@/lib/server/league-auth";

const seasonSchema = z.object({
  leagueId: z.string().min(1),
  name: z.string().trim().min(1, "Season name is required").max(100),
  startDate: z.coerce.date({ message: "Start date is required" }),
  endDate: z.coerce.date().optional(),
  description: z.string().trim().max(500).optional(),
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
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid season data");
  }

  const data = parsed.data;

  await requireLeagueRole(data.leagueId, LeagueRole.ADMIN);

  await prisma.$transaction(async (tx) => {
    await tx.season.updateMany({
      where: { leagueId: data.leagueId, isActive: true },
      data: { isActive: false },
    });

    await tx.season.create({
      data: {
        leagueId: data.leagueId,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        description: data.description,
        isActive: true,
      },
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
