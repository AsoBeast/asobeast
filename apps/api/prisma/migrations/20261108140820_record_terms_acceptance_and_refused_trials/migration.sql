-- AlterTable
ALTER TABLE "User" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "deletionStoppedRenewal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trialRefusedSubscriptionId" TEXT;
