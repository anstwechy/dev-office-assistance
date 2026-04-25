-- CreateTable
CREATE TABLE "Developer" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "skills" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legacyUserId" TEXT,

    CONSTRAINT "Developer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Developer_legacyUserId_key" ON "Developer"("legacyUserId");

INSERT INTO "Developer" ("id", "displayName", "skills", "createdAt", "updatedAt", "legacyUserId")
SELECT gen_random_uuid()::text,
       COALESCE(NULLIF(TRIM("displayName"), ''), split_part("email", '@', 1)),
       NULL,
       "createdAt",
       "updatedAt",
       "id"
FROM "User";

-- TriageItem: assignee user -> developer
ALTER TABLE "TriageItem" ADD COLUMN "assigneeDeveloperId" TEXT;

UPDATE "TriageItem" t
SET "assigneeDeveloperId" = d."id"
FROM "Developer" d
WHERE d."legacyUserId" = t."assigneeUserId";

ALTER TABLE "TriageItem" DROP CONSTRAINT "TriageItem_assigneeUserId_fkey";
DROP INDEX IF EXISTS "TriageItem_assigneeUserId_idx";
ALTER TABLE "TriageItem" DROP COLUMN "assigneeUserId";
ALTER TABLE "TriageItem" ALTER COLUMN "assigneeDeveloperId" SET NOT NULL;

ALTER TABLE "TriageItem" ADD CONSTRAINT "TriageItem_assigneeDeveloperId_fkey" FOREIGN KEY ("assigneeDeveloperId") REFERENCES "Developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TriageItem_assigneeDeveloperId_idx" ON "TriageItem"("assigneeDeveloperId");

-- TeamMembership: user -> developer
ALTER TABLE "TeamMembership" ADD COLUMN "developerId" TEXT;

UPDATE "TeamMembership" tm
SET "developerId" = d."id"
FROM "Developer" d
WHERE d."legacyUserId" = tm."userId";

ALTER TABLE "TeamMembership" DROP CONSTRAINT "TeamMembership_userId_fkey";
DROP INDEX IF EXISTS "TeamMembership_userId_team_key";
ALTER TABLE "TeamMembership" DROP COLUMN "userId";
ALTER TABLE "TeamMembership" ALTER COLUMN "developerId" SET NOT NULL;

CREATE UNIQUE INDEX "TeamMembership_developerId_team_key" ON "TeamMembership"("developerId", "team");
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "TeamMembership_developerId_idx" ON "TeamMembership"("developerId");

DROP INDEX IF EXISTS "Developer_legacyUserId_key";
ALTER TABLE "Developer" DROP COLUMN "legacyUserId";
