import { Prisma, SkillTier } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { playerSchema } from "@/lib/validations/player";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const skillTierParam = searchParams.get("skillTier") as SkillTier | null;

    const where: Prisma.PlayerWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (skillTierParam && Object.values(SkillTier).includes(skillTierParam)) {
      where.skillTier = skillTierParam;
    }

    const players = await prisma.player.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: players });
  } catch (error) {
    console.error("[PLAYERS_GET]", error);
    return NextResponse.json(
      { error: "Failed to load players" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = playerSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid player data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, phone, skillTier } = parsed.data;

    const player = await prisma.player.create({
      data: {
        name,
        email: email?.trim() ? email.trim() : undefined,
        phone: phone?.trim() ? phone.trim() : undefined,
        skillTier,
      },
    });

    return NextResponse.json({ data: player }, { status: 201 });
  } catch (error) {
    console.error("[PLAYERS_POST]", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "A player with this email already exists" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create player" },
      { status: 500 }
    );
  }
}
