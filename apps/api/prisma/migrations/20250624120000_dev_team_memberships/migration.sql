-- CreateEnum
CREATE TYPE "DevTeam" AS ENUM ('backend', 'qa', 'frontend_web', 'frontend_mobile');

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "team" "DevTeam" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_userId_team_key" ON "TeamMembership"("userId", "team");

-- CreateIndex
CREATE INDEX "TeamMembership_team_idx" ON "TeamMembership"("team");

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
