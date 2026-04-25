-- Local users with passwords (replaces Entra-oid user ids from initial scaffold).

DROP TABLE IF EXISTS "TriageItem";
DROP TABLE IF EXISTS "User";

CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "TriageItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TriageCategory" NOT NULL,
    "status" "TriageStatus" NOT NULL DEFAULT 'inbox',
    "nextAction" TEXT,
    "dueAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "assigneeUserId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'manual',
    "graphMessageId" TEXT,
    "graphWebLink" TEXT,
    "sourcePreview" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriageItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TriageItem_graphMessageId_key" ON "TriageItem"("graphMessageId");
CREATE INDEX "TriageItem_status_dueAt_idx" ON "TriageItem"("status", "dueAt");
CREATE INDEX "TriageItem_assigneeUserId_idx" ON "TriageItem"("assigneeUserId");
CREATE INDEX "TriageItem_category_idx" ON "TriageItem"("category");

ALTER TABLE "TriageItem" ADD CONSTRAINT "TriageItem_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TriageItem" ADD CONSTRAINT "TriageItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
