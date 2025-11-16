/*
  Warnings:

  - You are about to drop the `AdminUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SeasonAdmin` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[leagueId,name]` on the table `Player` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `leagueId` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `leagueId` to the `Season` table without a default value. This is not possible if the table is not empty.
  - Added the required column `leagueId` to the `TeamPlayer` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LeagueRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('SUPER_ADMIN');

-- DropForeignKey
ALTER TABLE "SeasonAdmin" DROP CONSTRAINT "SeasonAdmin_adminUserId_fkey";

-- DropForeignKey
ALTER TABLE "SeasonAdmin" DROP CONSTRAINT "SeasonAdmin_seasonId_fkey";

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "leagueId" TEXT;

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "leagueId" TEXT;

-- AlterTable
ALTER TABLE "TeamPlayer" ADD COLUMN     "leagueId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "systemRole" "SystemRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMembership" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "LeagueRole" NOT NULL DEFAULT 'MEMBER',
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueInvitation" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "role" "LeagueRole" NOT NULL DEFAULT 'ADMIN',
    "token" TEXT NOT NULL,
    "invitedEmail" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LeagueMembership_userId_idx" ON "LeagueMembership"("userId");

-- CreateIndex
CREATE INDEX "LeagueMembership_playerId_idx" ON "LeagueMembership"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMembership_leagueId_userId_key" ON "LeagueMembership"("leagueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueInvitation_token_key" ON "LeagueInvitation"("token");

-- Copy existing admin users into the new user table before dropping the legacy tables
INSERT INTO "User" ("id", "email", "name", "passwordHash", "systemRole", "createdAt", "updatedAt")
SELECT
    "id",
    "email",
    "name",
    "passwordHash",
    CASE WHEN "role" = 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::"SystemRole" ELSE NULL END,
    "createdAt",
    "updatedAt"
FROM "AdminUser";

-- Ensure there is at least one super admin user and a default league, then backfill references
DO $$
DECLARE
    default_user_id TEXT;
    default_league_id TEXT := 'default-league';
BEGIN
    SELECT "id" INTO default_user_id
    FROM "User"
    WHERE "systemRole" = 'SUPER_ADMIN'
    ORDER BY "createdAt" ASC
    LIMIT 1;

    IF default_user_id IS NULL THEN
        default_user_id := 'bootstrap-super-admin';
        INSERT INTO "User" ("id", "email", "name", "passwordHash", "systemRole", "createdAt", "updatedAt")
        VALUES (
            default_user_id,
            'bootstrap@padel-tracker.local',
            'Bootstrap Super Admin',
            '$2a$12$QJixyvfN9Fz7vRbG0sTkZuyGxLxV8I4D4G1hqYq3gK7D1Gp9ZlE2K',
            'SUPER_ADMIN',
            NOW(),
            NOW()
        )
        ON CONFLICT ("id") DO NOTHING;
    END IF;

    INSERT INTO "League" ("id", "name", "createdAt", "updatedAt", "createdById")
    VALUES (default_league_id, 'Magabull Padel', NOW(), NOW(), default_user_id)
    ON CONFLICT ("id") DO NOTHING;

    UPDATE "Player"
    SET "leagueId" = default_league_id
    WHERE "leagueId" IS NULL;

    UPDATE "Season"
    SET "leagueId" = default_league_id
    WHERE "leagueId" IS NULL;

    UPDATE "TeamPlayer" tp
    SET "leagueId" = COALESCE(tp."leagueId", p."leagueId", default_league_id)
    FROM "Player" p
    WHERE tp."playerId" = p."id";

    INSERT INTO "LeagueMembership" ("id", "leagueId", "userId", "role", "createdAt", "updatedAt")
    VALUES ('default-league-owner-membership', default_league_id, default_user_id, 'OWNER', NOW(), NOW())
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "LeagueMembership" ("id", "leagueId", "userId", "role", "createdAt", "updatedAt")
    SELECT
        sa."id",
        default_league_id,
        sa."adminUserId",
        'ADMIN',
        sa."createdAt",
        sa."createdAt"
    FROM "SeasonAdmin" sa
    ON CONFLICT ("id") DO NOTHING;
END;
$$;

-- Drop legacy admin tables and enum now that data has been migrated
DROP TABLE "AdminUser";

DROP TABLE "SeasonAdmin";

DROP TYPE "AdminRole";

-- CreateIndex
CREATE UNIQUE INDEX "Player_leagueId_name_key" ON "Player"("leagueId", "name");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueInvitation" ADD CONSTRAINT "LeagueInvitation_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueInvitation" ADD CONSTRAINT "LeagueInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce non-null league references now that data has been backfilled
ALTER TABLE "Player" ALTER COLUMN "leagueId" SET NOT NULL;
ALTER TABLE "Season" ALTER COLUMN "leagueId" SET NOT NULL;
ALTER TABLE "TeamPlayer" ALTER COLUMN "leagueId" SET NOT NULL;
