-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'SEASON_ADMIN');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'SEASON_ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonAdmin" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "SeasonAdmin_adminUserId_idx" ON "SeasonAdmin"("adminUserId");

-- CreateIndex
CREATE INDEX "SeasonAdmin_seasonId_idx" ON "SeasonAdmin"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonAdmin_seasonId_adminUserId_key" ON "SeasonAdmin"("seasonId", "adminUserId");

-- AddForeignKey
ALTER TABLE "SeasonAdmin" ADD CONSTRAINT "SeasonAdmin_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonAdmin" ADD CONSTRAINT "SeasonAdmin_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
