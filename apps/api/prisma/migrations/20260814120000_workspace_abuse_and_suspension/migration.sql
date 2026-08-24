-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "abuseFlaggedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;
