-- AlterTable
ALTER TABLE "User" ADD COLUMN "notify_email_triage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "notify_email_digest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TriageItem" ADD COLUMN "program" VARCHAR(200);
ALTER TABLE "TriageItem" ADD COLUMN "escalated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PlanningItem" ADD COLUMN "program" VARCHAR(200);

-- CreateIndex
CREATE INDEX "TriageItem_program_idx" ON "TriageItem"("program");

-- CreateTable
CREATE TABLE "PlanningTriageItem" (
    "planningItemId" TEXT NOT NULL,
    "triageItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningTriageItem_pkey" PRIMARY KEY ("planningItemId","triageItemId")
);

-- AddForeignKey
ALTER TABLE "PlanningTriageItem" ADD CONSTRAINT "PlanningTriageItem_planningItemId_fkey" FOREIGN KEY ("planningItemId") REFERENCES "PlanningItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanningTriageItem" ADD CONSTRAINT "PlanningTriageItem_triageItemId_fkey" FOREIGN KEY ("triageItemId") REFERENCES "TriageItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PlanningTriageItem_triageItemId_idx" ON "PlanningTriageItem"("triageItemId");

-- CreateTable
CREATE TABLE "StandupCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "priorWork" TEXT NOT NULL DEFAULT '',
    "nextWork" TEXT NOT NULL DEFAULT '',
    "blockers" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandupCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StandupCheckIn_userId_weekStart_key" ON "StandupCheckIn"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "StandupCheckIn_weekStart_idx" ON "StandupCheckIn"("weekStart");

-- AddForeignKey
ALTER TABLE "StandupCheckIn" ADD CONSTRAINT "StandupCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TeamDecision" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "decidedOn" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "relatedTriageItemId" TEXT,
    "relatedPlanningItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamDecision_decidedOn_idx" ON "TeamDecision"("decidedOn");

-- CreateIndex
CREATE INDEX "TeamDecision_createdById_idx" ON "TeamDecision"("createdById");

-- AddForeignKey
ALTER TABLE "TeamDecision" ADD CONSTRAINT "TeamDecision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamDecision" ADD CONSTRAINT "TeamDecision_relatedTriageItemId_fkey" FOREIGN KEY ("relatedTriageItemId") REFERENCES "TriageItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamDecision" ADD CONSTRAINT "TeamDecision_relatedPlanningItemId_fkey" FOREIGN KEY ("relatedPlanningItemId") REFERENCES "PlanningItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
