-- DropIndex
DROP INDEX "AlertEvent_dedupeKey_key";

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_workspaceId_dedupeKey_key" ON "AlertEvent"("workspaceId", "dedupeKey");
