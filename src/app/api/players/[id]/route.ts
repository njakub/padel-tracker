import { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { playerUpdateSchema } from "@/lib/validations/player";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteParams) {
  try {
  const { id } = await context.params;

    const player = await prisma.player.findUnique({
      where: { id },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    return NextResponse.json({ data: player });
  } catch (error) {
    console.error("[PLAYER_GET]", error);
    return NextResponse.json(
      { error: "Failed to load player" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
  const { id } = await context.params;
    const json = await request.json();
    const parsed = playerUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid player update", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    const data: Prisma.PlayerUpdateInput = {};

    if (payload.name !== undefined) {
      data.name = payload.name;
    }

    if (payload.skillTier !== undefined) {
      data.skillTier = payload.skillTier;
    }

    if (payload.email !== undefined) {
      data.email = payload.email.trim() ? payload.email.trim() : null;
    }

    if (payload.phone !== undefined) {
      data.phone = payload.phone.trim() ? payload.phone.trim() : null;
    }

    const player = await prisma.player.update({
      where: { id },
      data,
    });

    return NextResponse.json({ data: player });
  } catch (error) {
    console.error("[PLAYER_PATCH]", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Player not found" },
          { status: 404 }
        );
      }

      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "A player with this email already exists" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to update player" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteParams) {
  try {
  const { id } = await context.params;

    await prisma.player.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[PLAYER_DELETE]", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Player not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete player" },
      { status: 500 }
    );
  }
}
