"use server";

import { MatchSide, MatchStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  MatchCreateInput,
  MatchResultWithMatchInput,
  MatchUpdateInput,
  matchCreateSchema,
  matchResultWithMatchSchema,
  matchUpdateSchema,
} from "@/lib/validations/match";

const FALLBACK_LEAGUE_ROLE = {
  MEMBER: "MEMBER",
  ADMIN: "ADMIN",
  OWNER: "OWNER",
} as const;

type LeagueRole =
  (typeof FALLBACK_LEAGUE_ROLE)[keyof typeof FALLBACK_LEAGUE_ROLE];

const FALLBACK_SYSTEM_ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

const leagueRolePriority: Record<string, number> = {
  [FALLBACK_LEAGUE_ROLE.MEMBER]: 0,
  [FALLBACK_LEAGUE_ROLE.ADMIN]: 1,
  [FALLBACK_LEAGUE_ROLE.OWNER]: 2,
};

async function requireSessionUser() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("You must be signed in to manage matches");
  }

  return session.user;
}

async function requireLeagueRole(
  leagueId: string,
  minimumRole: LeagueRole = FALLBACK_LEAGUE_ROLE.ADMIN
) {
  const user = await requireSessionUser();

  if (user.systemRole === FALLBACK_SYSTEM_ROLE.SUPER_ADMIN) {
    return { userId: user.id, membershipRole: FALLBACK_LEAGUE_ROLE.OWNER };
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      leagueId_userId: {
        leagueId,
        userId: user.id,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    throw new Error("You are not a member of this league");
  }

  const membershipRole = (membership.role ??
    FALLBACK_LEAGUE_ROLE.MEMBER) as LeagueRole;

  if (
    (leagueRolePriority[membershipRole] ?? 0) < leagueRolePriority[minimumRole]
  ) {
    throw new Error("You do not have permission to manage this league");
  }

  return { userId: user.id, membershipRole };
}

async function requireAdminForSeason(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { leagueId: true },
  });

  if (!season) {
    throw new Error("Season not found");
  }

  await requireLeagueRole(season.leagueId, FALLBACK_LEAGUE_ROLE.ADMIN);

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

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { seasonId: true },
    });

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

export async function removeMatchResult(matchId: string) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { seasonId: true },
    });

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
