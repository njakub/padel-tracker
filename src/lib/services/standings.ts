import { MatchSide, MatchStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const POINTS_PER_WIN = 3;

export type StandingRow = {
  playerId: string;
  playerName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  setDifferential: number;
};

export type StandingsResponse = {
  season: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date | null;
  } | null;
  rows: StandingRow[];
};

export async function getStandings(
  seasonId?: string
): Promise<StandingsResponse> {
  const season = seasonId
    ? await prisma.season.findUnique({ where: { id: seasonId } })
    : await prisma.season.findFirst({
        where: { isActive: true },
        orderBy: { startDate: "desc" },
      });

  if (!season) {
    return { season: null, rows: [] };
  }

  const matches = await prisma.match.findMany({
    where: {
      seasonId: season.id,
      status: MatchStatus.COMPLETED,
    },
    include: {
      player1: { select: { id: true, name: true } },
      player2: { select: { id: true, name: true } },
      player3: { select: { id: true, name: true } },
      player4: { select: { id: true, name: true } },
    },
    orderBy: { matchNumber: "asc" },
  });

  const table = new Map<string, StandingRow>();

  const ensureRow = (
    playerId: string | null | undefined,
    name?: string | null
  ) => {
    if (!playerId) return undefined;
    if (!table.has(playerId)) {
      table.set(playerId, {
        playerId,
        playerName: name ?? "Unknown",
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        points: 0,
        setsWon: 0,
        setsLost: 0,
        setDifferential: 0,
      });
    }
    return table.get(playerId)!;
  };

  matches.forEach((match) => {
    const team1 = [
      match.player1Id
        ? { id: match.player1Id, name: match.player1?.name }
        : null,
      match.player2Id
        ? { id: match.player2Id, name: match.player2?.name }
        : null,
    ].filter(Boolean) as { id: string; name?: string | null }[];

    const team2 = [
      match.player3Id
        ? { id: match.player3Id, name: match.player3?.name }
        : null,
      match.player4Id
        ? { id: match.player4Id, name: match.player4?.name }
        : null,
    ].filter(Boolean) as { id: string; name?: string | null }[];

    if (!team1.length && !team2.length) {
      return;
    }

    const team1Sets = match.team1Sets ?? 0;
    const team2Sets = match.team2Sets ?? 0;

    team1.forEach(({ id, name }) => {
      const row = ensureRow(id, name ?? undefined);
      if (!row) return;
      row.matchesPlayed += 1;
      row.setsWon += team1Sets;
      row.setsLost += team2Sets;
      row.setDifferential = row.setsWon - row.setsLost;
      if (match.winnerSide === MatchSide.TEAM1) {
        row.wins += 1;
        row.points += POINTS_PER_WIN;
      } else if (match.winnerSide === MatchSide.TEAM2) {
        row.losses += 1;
      }
    });

    team2.forEach(({ id, name }) => {
      const row = ensureRow(id, name ?? undefined);
      if (!row) return;
      row.matchesPlayed += 1;
      row.setsWon += team2Sets;
      row.setsLost += team1Sets;
      row.setDifferential = row.setsWon - row.setsLost;
      if (match.winnerSide === MatchSide.TEAM2) {
        row.wins += 1;
        row.points += POINTS_PER_WIN;
      } else if (match.winnerSide === MatchSide.TEAM1) {
        row.losses += 1;
      }
    });
  });

  const rows = Array.from(table.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.setDifferential !== a.setDifferential) {
      return b.setDifferential - a.setDifferential;
    }
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
    return a.playerName.localeCompare(b.playerName);
  });

  return {
    season: {
      id: season.id,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
    },
    rows,
  };
}
