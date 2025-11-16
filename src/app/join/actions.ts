"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leagueRolePriority } from "@/lib/server/league-auth";

const acceptSchema = z.object({
  token: z.string().min(1),
  playerId: z.string().min(1).optional(),
});

export async function acceptInvitation(formData: FormData) {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token")?.toString() ?? "",
    playerId: (() => {
      const value = formData.get("playerId");
      if (typeof value !== "string" || value.length === 0) {
        return undefined;
      }
      return value;
    })(),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid invitation");
  }

  const { token, playerId } = parsed.data;

  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("You must be signed in to accept an invitation");
  }

  const invitation = await prisma.leagueInvitation.findUnique({
    where: { token },
    include: {
      league: {
        select: {
          id: true,
          players: { select: { id: true }, orderBy: { name: "asc" } },
        },
      },
    },
  });

  if (!invitation) {
    throw new Error("Invitation not found or already used");
  }

  const { leagueId } = invitation;

  if (playerId) {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { leagueId: true },
    });

    if (!player || player.leagueId !== leagueId) {
      throw new Error("Selected player does not belong to this league");
    }
  }

  const existingMembership = await prisma.leagueMembership.findUnique({
    where: {
      leagueId_userId: {
        leagueId,
        userId: session.user.id,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    if (existingMembership) {
      const currentPriority = leagueRolePriority[existingMembership.role];
      const invitePriority = leagueRolePriority[invitation.role];
      const nextRole =
        invitePriority > currentPriority
          ? invitation.role
          : existingMembership.role;

      await tx.leagueMembership.update({
        where: { id: existingMembership.id },
        data: {
          role: nextRole,
          playerId: playerId ?? existingMembership.playerId,
        },
      });
    } else {
      await tx.leagueMembership.create({
        data: {
          leagueId,
          userId: session.user.id,
          role: invitation.role,
          playerId: playerId ?? null,
        },
      });
    }

    await tx.leagueInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
  });

  revalidatePath(`/leagues/${leagueId}/standings`);
  revalidatePath(`/leagues/${leagueId}/settings`);
  revalidatePath("/profile");
  revalidatePath(`/join/${token}`);
}
