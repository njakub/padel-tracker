"use server";

import { LeagueRole, MatchSide, MatchStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getOrCreateAdhocSeason } from "@/lib/server/adhoc-season";
import { requireLeagueRole } from "@/lib/server/league-auth";
import {
  MatchCreateInput,
  MatchResultWithMatchInput,
  MatchUpdateInput,
  matchCreateSchema,
  matchResultWithMatchSchema,
  matchUpdateSchema,
} from "@/lib/validations/match";

async function requireAdminForSeason(seasonId: string) {
  const season = (await prisma.season.findUnique({
    where: { id: seasonId },
    select: { leagueId: true },
  })) as { leagueId: string } | null;

  if (!season) {
    throw new Error("Season not found");
  }

  await requireLeagueRole(season.leagueId, LeagueRole.ADMIN);

  return season.leagueId;
}

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

  const payload = {
    matchId: formData.get("matchId")?.toString() ?? "",
    seasonId: formData.get("seasonId")?.toString() ?? "",
    matchNumber: matchNumberRaw ? Number(matchNumberRaw) : undefined,
    date: dateValue ? dateValue : undefined,
    court: court || undefined,
    notes: notes || undefined,
    team1Sets: team1SetsRaw ? Number(team1SetsRaw) : undefined,
    team2Sets: team2SetsRaw ? Number(team2SetsRaw) : undefined,
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

const playerId = z.string().min(1, "Player is required");

const adhocMatchSchema = z
  .object({
    leagueId: z.string().min(1, "League is required"),
    playedAt: z.coerce.date({ message: "Enter the match date" }),
    court: z.string().trim().min(1, "Court is required").max(100),
    notes: z.string().trim().max(500).optional(),
    team1Sets: z.number().int().min(0).max(5),
    team2Sets: z.number().int().min(0).max(5),
    team1PlayerIds: z.array(playerId).length(2, "Select two players"),
    team2PlayerIds: z.array(playerId).length(2, "Select two players"),
  })
  .superRefine((data, ctx) => {
    if (data.team1Sets === data.team2Sets) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sets cannot tie",
        path: ["team1Sets"],
      });
    }

    const slots = [...data.team1PlayerIds, ...data.team2PlayerIds];
    if (new Set(slots).size !== slots.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Players must be unique across both teams",
        path: ["team1PlayerIds"],
      });
    }
  });

type AdhocMatchInput = z.infer<typeof adhocMatchSchema>;

function parseAdhocMatchForm(formData: FormData): AdhocMatchInput {
  const payload = {
    leagueId: formData.get("leagueId")?.toString() ?? "",
    playedAt: formData.get("playedAt")?.toString() ?? "",
    court: formData.get("court")?.toString() ?? "",
    notes: formData.get("notes")?.toString() || undefined,
    team1Sets: Number(formData.get("team1Sets") ?? 0),
    team2Sets: Number(formData.get("team2Sets") ?? 0),
    team1PlayerIds: [
      formData.get("team1Player1")?.toString() ?? "",
      formData.get("team1Player2")?.toString() ?? "",
    ],
    team2PlayerIds: [
      formData.get("team2Player1")?.toString() ?? "",
      formData.get("team2Player2")?.toString() ?? "",
    ],
  } satisfies Record<string, unknown>;

  const parsed = adhocMatchSchema.safeParse(payload);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid ad-hoc match data";
    throw new Error(message);
  }

  return parsed.data;
}

async function revalidateMatchesRoutes(leagueId: string) {
  revalidatePath(`/leagues/${leagueId}/standings`);
  revalidatePath(`/leagues/${leagueId}/matches`);
  revalidatePath(`/leagues/${leagueId}/schedule`);
}

export async function createMatch(formData: FormData) {
  try {
    const data = parseMatchCreateForm(formData);
    const leagueId = await requireAdminForSeason(data.seasonId);

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

    await revalidateMatchesRoutes(leagueId);

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
    const { matchId, team1Sets, team2Sets, notes, playedAt, court } = data;

    const match = (await prisma.match.findUnique({
      where: { id: matchId },
      select: { seasonId: true },
    })) as { seasonId: string } | null;

    if (!match) {
      throw new Error("Match not found");
    }

    const leagueId = await requireAdminForSeason(match.seasonId);
    const winnerSide =
      team1Sets > team2Sets ? MatchSide.TEAM1 : MatchSide.TEAM2;

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
    await revalidateMatchesRoutes(leagueId);

    return;
  } catch (error) {
    console.error("[RECORD_MATCH_RESULT]", error);
    const message =
      error instanceof Error ? error.message : "Failed to record result";
    throw new Error(message);
  }
}

export async function recordAdhocMatch(formData: FormData) {
  try {
    const data = parseAdhocMatchForm(formData);
    const { leagueId, team1Sets, team2Sets } = data;

    await requireLeagueRole(leagueId, LeagueRole.ADMIN);

    const seasonId = await getOrCreateAdhocSeason(leagueId);
    const matchNumber = (await prisma.match.count({ where: { seasonId } })) + 1;

    const winnerSide =
      team1Sets > team2Sets ? MatchSide.TEAM1 : MatchSide.TEAM2;

    await prisma.match.create({
      data: {
        seasonId,
        matchNumber,
        date: data.playedAt,
        court: data.court,
        notes: data.notes,
        isDoubles: true,
        player1Id: data.team1PlayerIds[0],
        player2Id: data.team1PlayerIds[1],
        player3Id: data.team2PlayerIds[0],
        player4Id: data.team2PlayerIds[1],
        status: MatchStatus.COMPLETED,
        team1Sets: data.team1Sets,
        team2Sets: data.team2Sets,
        winnerSide,
        completedAt: new Date(),
      },
    });

    await revalidateMatchesRoutes(leagueId);

    return;
  } catch (error) {
    console.error("[RECORD_ADHOC_MATCH]", error);
    const message =
      error instanceof Error ? error.message : "Failed to record ad-hoc match";
    throw new Error(message);
  }
}

export async function removeMatchResult(matchId: string) {
  try {
    const match = (await prisma.match.findUnique({
      where: { id: matchId },
      select: { seasonId: true },
    })) as { seasonId: string } | null;

    if (!match) {
      throw new Error("Match not found");
    }

    const leagueId = await requireAdminForSeason(match.seasonId);
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

    await revalidateMatchesRoutes(leagueId);

    return;
  } catch (error) {
    console.error("[REMOVE_MATCH_RESULT]", error);
    const message =
      error instanceof Error ? error.message : "Failed to remove match result";
    throw new Error(message);
  }
}

export const reopenMatch = removeMatchResult;

export async function deleteMatch(matchId: string) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        seasonId: true,
        season: { select: { leagueId: true, isAdhoc: true } },
      },
    });

    if (!match?.season) {
      throw new Error("Match not found");
    }

    await requireLeagueRole(match.season.leagueId, LeagueRole.ADMIN);

    await prisma.match.delete({ where: { id: matchId } });

    await revalidateMatchesRoutes(match.season.leagueId);

    return;
  } catch (error) {
    console.error("[DELETE_MATCH]", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete match";
    throw new Error(message);
  }
}

export async function updateMatch(formData: FormData) {
  try {
    const data = parseMatchUpdateForm(formData);
    const leagueId = await requireAdminForSeason(data.seasonId);
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
        winnerSide:
          typeof data.team1Sets === "number" &&
          typeof data.team2Sets === "number"
            ? data.team1Sets === data.team2Sets
              ? null
              : data.team1Sets > data.team2Sets
              ? MatchSide.TEAM1
              : MatchSide.TEAM2
            : null,
        team1Sets:
          typeof data.team1Sets === "number" ? data.team1Sets : undefined,
        team2Sets:
          typeof data.team2Sets === "number" ? data.team2Sets : undefined,
        status:
          typeof data.team1Sets === "number" &&
          typeof data.team2Sets === "number" &&
          data.team1Sets !== data.team2Sets
            ? MatchStatus.COMPLETED
            : undefined,
      },
    });

    await revalidateMatchesRoutes(leagueId);

    return;
  } catch (error) {
    console.error("[UPDATE_MATCH]", error);
    const message =
      error instanceof Error ? error.message : "Failed to update match";
    throw new Error(message);
  }
}
