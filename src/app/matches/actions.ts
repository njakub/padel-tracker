"use server";

import { MatchStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  MatchCreateInput,
  MatchResultWithMatchInput,
  MatchUpdateInput,
  matchCreateSchema,
  matchResultWithMatchSchema,
  matchUpdateSchema,
} from "@/lib/validations/match";

function parseMatchCreateForm(formData: FormData): MatchCreateInput {
  const seasonId = formData.get("seasonId")?.toString() ?? "";
  const dateValue = formData.get("date")?.toString() ?? "";
  const matchNumberRaw = formData.get("matchNumber")?.toString() ?? "";
  const court = formData.get("court")?.toString() ?? "";
  const notes = formData.get("notes")?.toString() ?? "";

  const payload = {
    seasonId,
    matchNumber: matchNumberRaw ? Number(matchNumberRaw) : undefined,
    date: dateValue ? dateValue : undefined,
    court: court || undefined,
    notes: notes || undefined,
    team1PlayerIds: [
      formData.get("team1Player1")?.toString() ?? "",
      formData.get("team1Player2")?.toString() ?? "",
    ],
    team2PlayerIds: [
      formData.get("team2Player1")?.toString() ?? "",
      formData.get("team2Player2")?.toString() ?? "",
    ],
    sitOutPlayerId: formData.get("sitOutPlayerId")?.toString() || undefined,
  } satisfies Record<string, unknown>;

  const parsed = matchCreateSchema.safeParse(payload);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid match data";
    throw new Error(message);
  }

  return parsed.data;
}

function parseMatchResultForm(formData: FormData): MatchResultWithMatchInput {
  const payload = {
    matchId: formData.get("matchId")?.toString() ?? "",
    winnerSide: formData.get("winnerSide")?.toString(),
    team1Sets: Number(formData.get("team1Sets") ?? 0),
    team2Sets: Number(formData.get("team2Sets") ?? 0),
    notes: formData.get("notes")?.toString() || undefined,
    playedAt: formData.get("playedAt")?.toString() ?? "",
    court: formData.get("court")?.toString() ?? "",
  } satisfies Record<string, unknown>;

  const parsed = matchResultWithMatchSchema.safeParse(payload);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid result data";
    throw new Error(message);
  }

  return parsed.data;
}

function parseMatchUpdateForm(formData: FormData): MatchUpdateInput {
  const dateValue = formData.get("date")?.toString() ?? "";
  const matchNumberRaw = formData.get("matchNumber")?.toString() ?? "";
  const court = formData.get("court")?.toString() ?? "";
  const notes = formData.get("notes")?.toString() ?? "";
  const team1SetsRaw = formData.get("team1Sets")?.toString() ?? "";
  const team2SetsRaw = formData.get("team2Sets")?.toString() ?? "";
  const winnerSideRaw = formData.get("winnerSide")?.toString() ?? "";

  const payload = {
    matchId: formData.get("matchId")?.toString() ?? "",
    seasonId: formData.get("seasonId")?.toString() ?? "",
    matchNumber: matchNumberRaw ? Number(matchNumberRaw) : undefined,
    date: dateValue ? dateValue : undefined,
    court: court || undefined,
    notes: notes || undefined,
    team1Sets: team1SetsRaw ? Number(team1SetsRaw) : undefined,
    team2Sets: team2SetsRaw ? Number(team2SetsRaw) : undefined,
    winnerSide: winnerSideRaw || undefined,
    team1PlayerIds: [
      formData.get("team1Player1")?.toString() ?? "",
      formData.get("team1Player2")?.toString() ?? "",
    ],
    team2PlayerIds: [
      formData.get("team2Player1")?.toString() ?? "",
      formData.get("team2Player2")?.toString() ?? "",
    ],
    sitOutPlayerId: formData.get("sitOutPlayerId")?.toString() || undefined,
  } satisfies Record<string, unknown>;

  const parsed = matchUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid match data";
    throw new Error(message);
  }

  return parsed.data;
}

async function revalidateMatchesRoutes() {
  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/schedule");
  revalidatePath("/standings");
}

export async function createMatch(formData: FormData) {
  try {
    const data = parseMatchCreateForm(formData);

    const matchNumber =
      data.matchNumber ??
      (await prisma.match.count({ where: { seasonId: data.seasonId } })) + 1;

    const [team1Player1, team1Player2] = data.team1PlayerIds;
    const [team2Player1, team2Player2] = data.team2PlayerIds;

    await prisma.match.create({
      data: {
        seasonId: data.seasonId,
        matchNumber,
        date: data.date ?? null,
        court: data.court ?? null,
        notes: data.notes,
        isDoubles: true,
        player1Id: team1Player1,
        player2Id: team1Player2,
        player3Id: team2Player1,
        player4Id: team2Player2,
        sitOutPlayerId: data.sitOutPlayerId,
        status: MatchStatus.SCHEDULED,
        team1Sets: 0,
        team2Sets: 0,
      },
    });

    revalidateMatchesRoutes();

    return;
  } catch (error) {
    console.error("[CREATE_MATCH]", error);
    const message =
      error instanceof Error ? error.message : "Failed to create match";
    throw new Error(message);
  }
}

export async function recordMatchResult(formData: FormData) {
  try {
    const data = parseMatchResultForm(formData);
    const {
      matchId,
      winnerSide,
      team1Sets,
      team2Sets,
      notes,
      playedAt,
      court,
    } = data;

    await prisma.match.update({
      where: { id: matchId },
      data: {
        date: playedAt,
        court,
        winnerSide,
        team1Sets,
        team2Sets,
        notes,
        status: MatchStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    revalidateMatchesRoutes();

    return;
  } catch (error) {
    console.error("[RECORD_MATCH_RESULT]", error);
    const message =
      error instanceof Error ? error.message : "Failed to record result";
    throw new Error(message);
  }
}

export async function removeMatchResult(matchId: string) {
  try {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.SCHEDULED,
        date: null,
        court: null,
        winnerSide: null,
        team1Sets: 0,
        team2Sets: 0,
        completedAt: null,
        notes: null,
        sets: {
          deleteMany: {},
        },
      },
    });

    revalidateMatchesRoutes();

    return;
  } catch (error) {
    console.error("[REMOVE_MATCH_RESULT]", error);
    const message =
      error instanceof Error ? error.message : "Failed to remove match result";
    throw new Error(message);
  }
}

export const reopenMatch = removeMatchResult;

export async function updateMatch(formData: FormData) {
  try {
    const data = parseMatchUpdateForm(formData);
    const [team1Player1, team1Player2] = data.team1PlayerIds;
    const [team2Player1, team2Player2] = data.team2PlayerIds;

    await prisma.match.update({
      where: { id: data.matchId },
      data: {
        matchNumber: data.matchNumber ?? undefined,
        date: data.date ?? null,
        court: data.court ?? null,
        notes: data.notes ?? null,
        player1Id: team1Player1,
        player2Id: team1Player2,
        player3Id: team2Player1,
        player4Id: team2Player2,
        sitOutPlayerId: data.sitOutPlayerId ?? null,
        winnerSide: data.winnerSide ?? null,
        team1Sets:
          typeof data.team1Sets === "number" ? data.team1Sets : undefined,
        team2Sets:
          typeof data.team2Sets === "number" ? data.team2Sets : undefined,
        status: data.winnerSide ? MatchStatus.COMPLETED : undefined,
      },
    });

    revalidateMatchesRoutes();

    return;
  } catch (error) {
    console.error("[UPDATE_MATCH]", error);
    const message =
      error instanceof Error ? error.message : "Failed to update match";
    throw new Error(message);
  }
}
