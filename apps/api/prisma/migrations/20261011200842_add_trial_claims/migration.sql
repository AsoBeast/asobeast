-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "trialDeclinedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TrialClaim" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialClaim_pkey" PRIMARY KEY ("key")
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "TrialClaim" TO asobeast_app;

ALTER TABLE "TrialClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrialClaim" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "TrialClaim"
  USING (app_tenancy_bypassed());
