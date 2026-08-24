-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "checkoutClaimedAt" TIMESTAMP(3),
ADD COLUMN     "checkoutSessionId" TEXT;
