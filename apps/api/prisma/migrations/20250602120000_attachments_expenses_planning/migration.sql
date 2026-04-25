-- CreateEnum
CREATE TYPE "PlanningStatus" AS ENUM ('draft', 'active', 'done', 'cancelled');

-- CreateTable
CREATE TABLE "TriageAttachment" (
    "id" TEXT NOT NULL,
    "triageItemId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "department" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "receiptKey" TEXT,
    "receiptName" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "targetDate" TIMESTAMP(3),
    "status" "PlanningStatus" NOT NULL DEFAULT 'draft',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TriageAttachment_storageKey_key" ON "TriageAttachment"("storageKey");
CREATE INDEX "TriageAttachment_triageItemId_idx" ON "TriageAttachment"("triageItemId");
CREATE INDEX "Expense_department_idx" ON "Expense"("department");
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE INDEX "PlanningItem_status_idx" ON "PlanningItem"("status");
CREATE INDEX "PlanningItem_targetDate_idx" ON "PlanningItem"("targetDate");

ALTER TABLE "TriageAttachment" ADD CONSTRAINT "TriageAttachment_triageItemId_fkey" FOREIGN KEY ("triageItemId") REFERENCES "TriageItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TriageAttachment" ADD CONSTRAINT "TriageAttachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanningItem" ADD CONSTRAINT "PlanningItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
