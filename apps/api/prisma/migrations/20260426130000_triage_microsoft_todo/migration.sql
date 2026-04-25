-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'microsoft_todo';

-- AlterTable
ALTER TABLE "TriageItem" ADD COLUMN     "graphTodoListId" TEXT,
ADD COLUMN     "graphTodoTaskId" TEXT,
ADD COLUMN     "lastTodoSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "TriageItem_graphTodoListId_graphTodoTaskId_key" ON "TriageItem"("graphTodoListId", "graphTodoTaskId");
