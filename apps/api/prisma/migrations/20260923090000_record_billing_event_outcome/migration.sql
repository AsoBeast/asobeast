ALTER TABLE "BillingEvent" ADD COLUMN "outcome" TEXT;

UPDATE "BillingEvent" SET "outcome" = 'applied' WHERE "processedAt" IS NOT NULL;

UPDATE "BillingEvent"
SET "outcome" = 'orphaned', "processedAt" = CURRENT_TIMESTAMP, "failure" = NULL
WHERE "processedAt" IS NULL
  AND ("failure" LIKE 'stripe subscription % belongs to no known workspace'
    OR "failure" LIKE 'stripe subscription % which belongs to a different customer');

CREATE INDEX "BillingEvent_outcome_receivedAt_idx" ON "BillingEvent"("outcome", "receivedAt");
