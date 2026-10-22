-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "billingInterval" TEXT,
ADD COLUMN     "firstPaidAt" TIMESTAMP(3),
ADD COLUMN     "trialClaimedAt" TIMESTAMP(3);

UPDATE "Workspace" SET "firstPaidAt" = COALESCE("subscriptionEventAt", NOW())
WHERE "subscriptionStatus" IN ('active', 'past_due', 'unpaid', 'paused') AND "firstPaidAt" IS NULL;

UPDATE "Workspace" SET "trialClaimedAt" = "trialStartedAt"
WHERE "trialStartedAt" IS NOT NULL AND "trialClaimedAt" IS NULL;

UPDATE "Workspace" SET "trialNoticeDay" = 8
WHERE "trialStartedAt" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "trialEndsAt" <= NOW())
  AND ("trialNoticeDay" IS NULL OR "trialNoticeDay" < 8);
