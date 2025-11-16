"use server";

import { LeagueRole, SkillTier } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireLeagueRole } from "@/lib/server/league-auth";

const playerSchema = z.object({
  leagueId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z
    .string()
    .trim()
    .max(50, "Phone is too long")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  skillTier: z.nativeEnum(SkillTier).default(SkillTier.INTERMEDIATE),
});

const updatePlayerSchema = playerSchema.extend({
  playerId: z.string().min(1, "Player is required"),
});

function revalidateLeaguePlayerViews(leagueId: string) {
  revalidatePath(`/leagues/${leagueId}/players`);
  revalidatePath(`/leagues/${leagueId}/schedule`);
  revalidatePath(`/leagues/${leagueId}/matches`);
}

export async function createPlayer(formData: FormData) {
  const leagueId = formData.get("leagueId")?.toString() ?? "";

  await requireLeagueRole(leagueId, LeagueRole.ADMIN);

  const parsed = playerSchema.safeParse({
    leagueId,
    name: formData.get("name")?.toString() ?? "",
    email: formData.get("email")?.toString(),
    phone: formData.get("phone")?.toString(),
    skillTier: (formData.get("skillTier")?.toString() ??
      SkillTier.INTERMEDIATE) as SkillTier,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid player data");
  }

  const data = parsed.data;

  await prisma.player.create({
    data: {
      leagueId: data.leagueId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      skillTier: data.skillTier,
    },
  });

  revalidateLeaguePlayerViews(data.leagueId);
}

export async function updatePlayer(formData: FormData) {
  const leagueId = formData.get("leagueId")?.toString() ?? "";

  await requireLeagueRole(leagueId, LeagueRole.ADMIN);

  const parsed = updatePlayerSchema.safeParse({
    leagueId,
    playerId: formData.get("playerId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    email: formData.get("email")?.toString(),
    phone: formData.get("phone")?.toString(),
    skillTier: (formData.get("skillTier")?.toString() ??
      SkillTier.INTERMEDIATE) as SkillTier,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid player data");
  }

  const data = parsed.data;

  await prisma.player.update({
    where: { id: data.playerId },
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      skillTier: data.skillTier,
    },
  });

  revalidateLeaguePlayerViews(data.leagueId);
}

export async function deletePlayer(playerId: string, leagueId: string) {
  await requireLeagueRole(leagueId, LeagueRole.ADMIN);

  await prisma.player.delete({
    where: { id: playerId },
  });

  revalidateLeaguePlayerViews(leagueId);
}
