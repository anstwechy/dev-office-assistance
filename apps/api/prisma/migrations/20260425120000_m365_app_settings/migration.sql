-- CreateTable
CREATE TABLE "M365AppSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "clientId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "M365AppSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "M365AppSettings" ("id", "tenantId", "clientId", "updatedAt")
VALUES ('default', NULL, NULL, CURRENT_TIMESTAMP);
