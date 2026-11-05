-- AlterTable
ALTER TABLE "EmailAlert" ADD COLUMN     "defaultOrigin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "introSentAt" TIMESTAMP(3),
ADD COLUMN     "rankDropThreshold" INTEGER;

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "rankDropThreshold" INTEGER;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "defaultAlertsAt" TIMESTAMP(3);

UPDATE "Workspace" SET "defaultAlertsAt" = "createdAt";
