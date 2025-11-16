import { MatchSide, MatchStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type StandingRow = {
  playerId: string;
  playerName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  gamesWon: number;
  gamesLost: number;
  gameDifferential: number;
};

export type StandingsResponse = {
  season: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date | null;
  } | null;
  rows: StandingRow[];
  teamRows: TeamStandingRow[];
};

export type TeamStandingRow = {
  teamKey: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  gamesWon: number;
  gamesLost: number;
  gameDifferential: number;
};

export async function getStandings(params?: {
  leagueId?: string;
  seasonId?: string;
}): Promise<StandingsResponse> {
  const leagueId = params?.leagueId;
  const seasonId = params?.seasonId;

  const season = seasonId
    ? await prisma.season.findUnique({ where: { id: seasonId } })
    : await prisma.season.findFirst({
        where: {
          ...(leagueId ? { leagueId } : {}),
          isActive: true,
        },
        orderBy: { startDate: "desc" },
      });

  if (!season) {
    return { season: null, rows: [], teamRows: [] };
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
  const teamTable = new Map<string, TeamStandingRow>();

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
        gamesWon: 0,
        gamesLost: 0,
        gameDifferential: 0,
      });
    }
    return table.get(playerId)!;
  };

  const ensureTeamRow = (
    members: { id: string; name?: string | null }[]
  ) => {
    if (members.length < 2) {
      return undefined;
    }

    const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
    const key = sorted.map((player) => player.id).join("|");

    if (!key) return undefined;

    if (!teamTable.has(key)) {
      const name = sorted
        .map((player) => player.name ?? "Unknown")
        .join(" & ");

      teamTable.set(key, {
        teamKey: key,
        teamName: name,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        points: 0,
        gamesWon: 0,
        gamesLost: 0,
        gameDifferential: 0,
      });
    }

    return teamTable.get(key)!;
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

    const team1Games = match.team1Sets ?? 0;
    const team2Games = match.team2Sets ?? 0;

    const team1Row = ensureTeamRow(team1);
    const team2Row = ensureTeamRow(team2);

    team1.forEach(({ id, name }) => {
      const row = ensureRow(id, name ?? undefined);
      if (!row) return;
      row.matchesPlayed += 1;
      row.gamesWon += team1Games;
      row.gamesLost += team2Games;
      row.points += team1Games;
      row.gameDifferential = row.gamesWon - row.gamesLost;
      if (match.winnerSide === MatchSide.TEAM1) {
        row.wins += 1;
        row.points += 1;
      } else if (match.winnerSide === MatchSide.TEAM2) {
        row.losses += 1;
      }
    });

    team2.forEach(({ id, name }) => {
      const row = ensureRow(id, name ?? undefined);
      if (!row) return;
      row.matchesPlayed += 1;
      row.gamesWon += team2Games;
      row.gamesLost += team1Games;
      row.points += team2Games;
      row.gameDifferential = row.gamesWon - row.gamesLost;
      if (match.winnerSide === MatchSide.TEAM2) {
        row.wins += 1;
        row.points += 1;
      } else if (match.winnerSide === MatchSide.TEAM1) {
        row.losses += 1;
      }
    });

    if (team1Row) {
      team1Row.matchesPlayed += 1;
      team1Row.gamesWon += team1Games;
      team1Row.gamesLost += team2Games;
      team1Row.points += team1Games;
      team1Row.gameDifferential = team1Row.gamesWon - team1Row.gamesLost;
      if (match.winnerSide === MatchSide.TEAM1) {
        team1Row.wins += 1;
        team1Row.points += 1;
      } else if (match.winnerSide === MatchSide.TEAM2) {
        team1Row.losses += 1;
      }
    }

    if (team2Row) {
      team2Row.matchesPlayed += 1;
      team2Row.gamesWon += team2Games;
      team2Row.gamesLost += team1Games;
      team2Row.points += team2Games;
      team2Row.gameDifferential = team2Row.gamesWon - team2Row.gamesLost;
      if (match.winnerSide === MatchSide.TEAM2) {
        team2Row.wins += 1;
        team2Row.points += 1;
      } else if (match.winnerSide === MatchSide.TEAM1) {
        team2Row.losses += 1;
      }
    }
  });

  const rows = Array.from(table.values())
    .map((row) => ({
      ...row,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      if (b.gameDifferential !== a.gameDifferential) {
        return b.gameDifferential - a.gameDifferential;
      }
      return a.playerName.localeCompare(b.playerName);
    });

  const teamRows = Array.from(teamTable.values())
    .map((row) => ({ ...row }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      if (b.gameDifferential !== a.gameDifferential) {
        return b.gameDifferential - a.gameDifferential;
      }
      return a.teamName.localeCompare(b.teamName);
    });

  return {
    season: {
      id: season.id,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
    },
    rows,
    teamRows,
  };
}
