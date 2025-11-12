import { PrismaClient, SkillTier } from "@prisma/client";

const prisma = new PrismaClient();

const schedule = [
  {
    matchNumber: 1,
    sitOut: "Matt",
    team1: ["Joe", "Jakub"],
    team2: ["Charlie", "Jon"],
  },
  {
    matchNumber: 2,
    sitOut: "Joe",
    team1: ["Matt", "Charlie"],
    team2: ["Jakub", "Jon"],
  },
  {
    matchNumber: 3,
    sitOut: "Jakub",
    team1: ["Matt", "Joe"],
    team2: ["Charlie", "Jon"],
  },
  {
    matchNumber: 4,
    sitOut: "Charlie",
    team1: ["Matt", "Jakub"],
    team2: ["Joe", "Jon"],
  },
  {
    matchNumber: 5,
    sitOut: "Jon",
    team1: ["Matt", "Charlie"],
    team2: ["Joe", "Jakub"],
  },
  {
    matchNumber: 6,
    sitOut: "Matt",
    team1: ["Joe", "Charlie"],
    team2: ["Jakub", "Jon"],
  },
  {
    matchNumber: 7,
    sitOut: "Joe",
    team1: ["Matt", "Jon"],
    team2: ["Jakub", "Charlie"],
  },
  {
    matchNumber: 8,
    sitOut: "Jakub",
    team1: ["Matt", "Charlie"],
    team2: ["Joe", "Jon"],
  },
  {
    matchNumber: 9,
    sitOut: "Charlie",
    team1: ["Matt", "Joe"],
    team2: ["Jakub", "Jon"],
  },
  {
    matchNumber: 10,
    sitOut: "Jon",
    team1: ["Matt", "Jakub"],
    team2: ["Joe", "Charlie"],
  },
  {
    matchNumber: 11,
    sitOut: "Matt",
    team1: ["Joe", "Jon"],
    team2: ["Jakub", "Charlie"],
  },
  {
    matchNumber: 12,
    sitOut: "Joe",
    team1: ["Matt", "Charlie"],
    team2: ["Jakub", "Jon"],
  },
  {
    matchNumber: 13,
    sitOut: "Jakub",
    team1: ["Matt", "Jon"],
    team2: ["Joe", "Charlie"],
  },
  {
    matchNumber: 14,
    sitOut: "Charlie",
    team1: ["Matt", "Jakub"],
    team2: ["Joe", "Jon"],
  },
  {
    matchNumber: 15,
    sitOut: "Jon",
    team1: ["Matt", "Joe"],
    team2: ["Jakub", "Charlie"],
  },
] as const;

async function main() {
  const playersData = [
    { name: "Matt", email: "matt@example.com" },
    { name: "Joe", email: "joe@example.com" },
    { name: "Jakub", email: "jakub@example.com" },
    { name: "Charlie", email: "charlie@example.com" },
    { name: "Jon", email: "jon@example.com" },
  ];

  const players = new Map<string, string>();

  for (const player of playersData) {
    const record = await prisma.player.upsert({
      where: { email: player.email },
      update: {
        name: player.name,
        skillTier: SkillTier.INTERMEDIATE,
      },
      create: {
        name: player.name,
        email: player.email,
        skillTier: SkillTier.INTERMEDIATE,
      },
    });

    players.set(player.name, record.id);
  }

  const season = await prisma.season.upsert({
    where: { name: "Season 1" },
    update: {
      isActive: true,
      endDate: null,
    },
    create: {
      name: "Season 1",
      startDate: new Date("2025-01-06T18:00:00.000Z"),
      isActive: true,
      description: "Inaugural padel league season",
    },
  });

  await prisma.matchSet.deleteMany({
    where: { match: { seasonId: season.id } },
  });
  await prisma.match.deleteMany({ where: { seasonId: season.id } });

  const startDate = new Date("2025-01-06T18:00:00.000Z");
  const courtNames = ["Center Court", "Court 1", "Court 2"];

  for (const entry of schedule) {
    const matchDate = new Date(startDate);
    matchDate.setDate(startDate.getDate() + (entry.matchNumber - 1) * 7);

    const [team1PlayerA, team1PlayerB] = entry.team1.map((name) =>
      players.get(name)
    );
    const [team2PlayerA, team2PlayerB] = entry.team2.map((name) =>
      players.get(name)
    );
    const sitOutId = players.get(entry.sitOut);

    if (
      !team1PlayerA ||
      !team1PlayerB ||
      !team2PlayerA ||
      !team2PlayerB ||
      !sitOutId
    ) {
      throw new Error(`Missing player for match ${entry.matchNumber}`);
    }

    await prisma.match.create({
      data: {
        seasonId: season.id,
        matchNumber: entry.matchNumber,
        date: matchDate,
        court: courtNames[(entry.matchNumber - 1) % courtNames.length],
        isDoubles: true,
        sitOutPlayerId: sitOutId,
        player1Id: team1PlayerA,
        player2Id: team1PlayerB,
        player3Id: team2PlayerA,
        player4Id: team2PlayerB,
        status: entry.matchNumber === 1 ? "SCHEDULED" : undefined,
      },
    });
  }

  console.log("Seeded Season 1 schedule with", schedule.length, "matches");
}

main()
  .catch((error) => {
    console.error("Failed to seed data", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
