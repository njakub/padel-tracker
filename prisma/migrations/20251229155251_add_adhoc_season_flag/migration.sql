/*
  Warnings:

  - A unique constraint covering the columns `[leagueId,name]` on the table `Season` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Season_name_key";

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "isAdhoc" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Season_leagueId_name_key" ON "Season"("leagueId", "name");
