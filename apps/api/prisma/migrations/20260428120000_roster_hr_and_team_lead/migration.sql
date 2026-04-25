-- CreateEnum
CREATE TYPE "RosterPosition" AS ENUM ('member', 'department_head', 'department_assistant');

-- AlterTable
ALTER TABLE "Developer" ADD COLUMN     "job_title" VARCHAR(200),
ADD COLUMN     "hire_date" DATE,
ADD COLUMN     "tenure_label" VARCHAR(120),
ADD COLUMN     "roster_position" "RosterPosition" NOT NULL DEFAULT 'member';

-- CreateIndex: business emails unique when present (NULL allowed multiple times in PostgreSQL)
CREATE UNIQUE INDEX "Developer_work_email_key" ON "Developer"("work_email");

-- AlterTable
ALTER TABLE "TeamMembership" ADD COLUMN     "is_team_lead" BOOLEAN NOT NULL DEFAULT false;
