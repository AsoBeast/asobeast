-- AlterTable
ALTER TABLE "User" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "deletionStoppedSubscriptionId" TEXT,
ADD COLUMN     "trialRefusedSubscriptionId" TEXT;
