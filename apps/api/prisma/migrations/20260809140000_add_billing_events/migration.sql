-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pendingPlan" TEXT,
ADD COLUMN     "subscriptionEventAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" TEXT;

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failure" TEXT,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingEvent_processedAt_idx" ON "BillingEvent"("processedAt");


GRANT SELECT, INSERT, UPDATE, DELETE ON "BillingEvent" TO asobeast_app;

ALTER TABLE "BillingEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "BillingEvent"
  USING (app_tenancy_bypassed());
