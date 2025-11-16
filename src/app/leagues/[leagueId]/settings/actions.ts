"use server";

import { LeagueRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireLeagueRole } from "@/lib/server/league-auth";

const invitationSchema = z.object({
  leagueId: z.string().min(1),
  role: z.nativeEnum(LeagueRole).default(LeagueRole.ADMIN),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

function revalidateSettings(leagueId: string) {
  revalidatePath(`/leagues/${leagueId}/settings`);
}

export async function createInvitation(formData: FormData) {
  const parsed = invitationSchema.safeParse({
    leagueId: formData.get("leagueId")?.toString() ?? "",
    role: formData.get("role")?.toString() ?? LeagueRole.ADMIN,
    email: formData.get("email")?.toString(),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid invitation");
  }

  const data = parsed.data;

  const requester = await requireLeagueRole(data.leagueId, LeagueRole.ADMIN);

  if (requester.role === LeagueRole.ADMIN && data.role === LeagueRole.OWNER) {
    throw new Error("Only owners can invite new owners");
  }

  await prisma.leagueInvitation.create({
    data: {
      leagueId: data.leagueId,
      invitedById: requester.userId,
      role: data.role,
      invitedEmail: data.email,
      token: randomUUID(),
    },
  });

  revalidateSettings(data.leagueId);
}

export async function revokeInvitation(invitationId: string, leagueId: string) {
  await requireLeagueRole(leagueId, LeagueRole.ADMIN);

  await prisma.leagueInvitation.delete({
    where: { id: invitationId },
  });

  revalidateSettings(leagueId);
}
