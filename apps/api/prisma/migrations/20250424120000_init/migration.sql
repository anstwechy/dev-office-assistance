-- CreateEnum
CREATE TYPE "TriageCategory" AS ENUM ('blocker', 'risk', 'quality', 'process', 'other');

-- CreateEnum
CREATE TYPE "TriageStatus" AS ENUM ('inbox', 'in_progress', 'snoozed', 'done', 'dropped');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('outlook', 'manual');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "TriageItem_graphMessageId_key" ON "TriageItem"("graphMessageId");

-- CreateIndex
CREATE INDEX "TriageItem_status_dueAt_idx" ON "TriageItem"("status", "dueAt");

-- CreateIndex
CREATE INDEX "TriageItem_assigneeUserId_idx" ON "TriageItem"("assigneeUserId");

-- CreateIndex
CREATE INDEX "TriageItem_category_idx" ON "TriageItem"("category");

-- AddForeignKey
ALTER TABLE "TriageItem" ADD CONSTRAINT "TriageItem_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageItem" ADD CONSTRAINT "TriageItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
