"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const linkSchema = z.object({
  membershipId: z.string().min(1),
  playerId: z.string().min(1).nullable(),
});

export type LinkState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function linkMembershipToPlayer(
  _prevState: LinkState,
  formData: FormData
): Promise<LinkState> {
  try {
    const parsed = linkSchema.safeParse({
      membershipId: formData.get("membershipId")?.toString() ?? "",
      playerId: (() => {
        const value = formData.get("playerId");
        if (typeof value !== "string") return null;
        if (value.length === 0 || value === "none") {
          return null;
        }
        return value;
      })(),
    });

    if (!parsed.success) {
      return {
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Invalid selection",
      };
    }

    const { membershipId, playerId } = parsed.data;

    const session = await auth();

    if (!session?.user?.id) {
      return { status: "error", message: "You must be signed in." };
    }

    const membership = await prisma.leagueMembership.findUnique({
      where: { id: membershipId },
      select: { userId: true, leagueId: true },
    });

    if (!membership || membership.userId !== session.user.id) {
      return {
        status: "error",
        message: "You do not have access to this membership.",
      };
    }

    let playerName: string | null = null;

    if (playerId) {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { leagueId: true, name: true },
      });

      if (!player || player.leagueId !== membership.leagueId) {
        return {
          status: "error",
          message: "Player does not belong to this league.",
        };
      }

      playerName = player.name ?? null;
    }

    await prisma.leagueMembership.update({
      where: { id: membershipId },
      data: { playerId: playerId ?? null },
    });

    revalidatePath("/profile");
    revalidatePath(`/leagues/${membership.leagueId}/schedule`);
    revalidatePath(`/leagues/${membership.leagueId}/matches`);

    return {
      status: "success",
      message: playerId
        ? `Linked to ${playerName ?? "selected player"}.`
        : "Player link cleared.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to update player mapping.",
    };
  }
}
