export type DoublesFixture = {
  /** 1-based within the season */
  matchNumber: number;
  /** Two player ids for team 1 */
  team1: readonly [string, string];
  /** Two player ids for team 2 */
  team2: readonly [string, string];
  /** Player id sitting out (5th player) */
  sitOut: string;
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

function hasDuplicatePlayers(fixture: Omit<DoublesFixture, "matchNumber">) {
  const all = [
    fixture.team1[0],
    fixture.team1[1],
    fixture.team2[0],
    fixture.team2[1],
    fixture.sitOut,
  ];
  return new Set(all).size !== all.length;
}

/**
 * Generates a perfectly partner-balanced doubles schedule for exactly 5 players.
 *
 * Contract:
 * - Input: 5 distinct player ids, seasonLengthMatches multiple of 5.
 * - Output: fixtures where every unordered teammate pair appears exactly k times,
 *   where k = seasonLengthMatches / 5.
 *
 * Notes:
 * - This guarantees partner balance. It does not try to optimize opponent balance.
 */
export function generatePartnerBalanced5PlayerDoublesFixtures(args: {
  playerIds: readonly [string, string, string, string, string];
  seasonLengthMatches: number;
}): DoublesFixture[] {
  const { playerIds, seasonLengthMatches } = args;

  if (new Set(playerIds).size !== 5) {
    throw new Error("Expected 5 distinct players");
  }

  if (seasonLengthMatches <= 0 || seasonLengthMatches % 5 !== 0) {
    throw new Error("Season length must be a positive multiple of 5");
  }

  const k = seasonLengthMatches / 5;
  const fixtures: DoublesFixture[] = [];

  // Build 5-match "rounds"; each round sits out each player once.
  // In a round, the 4 active players are paired using one of the 3 possible perfect matchings.
  // We rotate matchings across rounds to equalize partner counts.
  const [p0, p1, p2, p3, p4] = playerIds;

  const sitOutOrder = [p0, p1, p2, p3, p4] as const;

  // Three possible pairings for four players [a,b,c,d]
  const matchings = [
    (a: string, b: string, c: string, d: string) => ({
      team1: [a, b] as const,
      team2: [c, d] as const,
    }),
    (a: string, b: string, c: string, d: string) => ({
      team1: [a, c] as const,
      team2: [b, d] as const,
    }),
    (a: string, b: string, c: string, d: string) => ({
      team1: [a, d] as const,
      team2: [b, c] as const,
    }),
  ] as const;

  // Track partner usage so we can greedily select the matching that best balances pairs.
  const partnerCounts = new Map<string, number>();

  function incPair(a: string, b: string) {
    const key = pairKey(a, b);
    partnerCounts.set(key, (partnerCounts.get(key) ?? 0) + 1);
  }

  function scoreMatching(teams: {
    team1: readonly [string, string];
    team2: readonly [string, string];
  }) {
    const pA = pairKey(teams.team1[0], teams.team1[1]);
    const pB = pairKey(teams.team2[0], teams.team2[1]);
    const cA = partnerCounts.get(pA) ?? 0;
    const cB = partnerCounts.get(pB) ?? 0;
    // Prefer the matching that uses currently least-used partner pairs.
    return cA + cB;
  }

  let matchNumber = 1;
  for (let round = 0; round < k; round++) {
    for (let s = 0; s < sitOutOrder.length; s++) {
      const sitOut = sitOutOrder[s];
      const active = playerIds.filter((id) => id !== sitOut);

      // Active is 4 players; keep deterministic ordering.
      const [a, b, c, d] = active as [string, string, string, string];

      // Pick the best matching given current partner counts.
      const candidates = matchings
        .map((fn) => fn(a, b, c, d))
        .map((teams) => ({ teams, score: scoreMatching(teams) }))
        .sort((x, y) => x.score - y.score);

      const chosen = candidates[0]?.teams;
      if (!chosen) {
        throw new Error("Failed to choose teams");
      }

      const fixture: DoublesFixture = {
        matchNumber,
        team1: chosen.team1,
        team2: chosen.team2,
        sitOut,
      };

      if (hasDuplicatePlayers(fixture)) {
        throw new Error(
          `Invalid fixture (duplicate player) at match ${matchNumber}`
        );
      }

      fixtures.push(fixture);
      incPair(fixture.team1[0], fixture.team1[1]);
      incPair(fixture.team2[0], fixture.team2[1]);
      matchNumber++;
    }
  }

  // Validate partner balance.
  const expected = k;
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const key = pairKey(playerIds[i], playerIds[j]);
      const count = partnerCounts.get(key) ?? 0;
      if (count !== expected) {
        throw new Error(
          `Partner-balance invariant failed: pair ${key} has ${count}, expected ${expected}`
        );
      }
    }
  }

  if (fixtures.length !== seasonLengthMatches) {
    throw new Error(
      `Expected ${seasonLengthMatches} fixtures, generated ${fixtures.length}`
    );
  }

  return fixtures;
}
