-- AlterTable
ALTER TABLE "Developer" ADD COLUMN     "work_email" VARCHAR(320),
ADD COLUMN     "phone" VARCHAR(64),
ADD COLUMN     "location" VARCHAR(200),
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "skill_details" TEXT,
ADD COLUMN     "achievements" TEXT;
