import { LeagueRole, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const targetEmail = "njakub94@gmail.com";
  const desiredName = "Magabull Padel";

  const league = await prisma.league.findFirst({
    where: { name: { in: ["Default League", desiredName] } },
  });

  if (!league) {
    throw new Error(
      "Could not find a league named 'Default League' or 'Magabull Padel'."
    );
  }

  if (league.name !== desiredName) {
    await prisma.league.update({
      where: { id: league.id },
      data: { name: desiredName },
    });
    console.log(`Renamed league ${league.id} to ${desiredName}`);
  } else {
    console.log(`League already named ${desiredName}`);
  }

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
  });

  if (!user) {
    throw new Error(`No user found with email ${targetEmail}`);
  }

  await prisma.leagueMembership.upsert({
    where: {
      leagueId_userId: {
        leagueId: league.id,
        userId: user.id,
      },
    },
    update: {
      role: LeagueRole.ADMIN,
    },
    create: {
      leagueId: league.id,
      userId: user.id,
      role: LeagueRole.ADMIN,
    },
  });

  console.log(
    `User ${targetEmail} is now an admin of league ${desiredName} (${league.id}).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
