-- DropIndex
DROP INDEX "AlertEvent_workspaceId_flushedAt_idx";

-- AlterTable
ALTER TABLE "AlertEvent" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "flushId" TEXT;

-- CreateIndex
CREATE INDEX "AlertEvent_workspaceId_flushedAt_claimedAt_idx" ON "AlertEvent"("workspaceId", "flushedAt", "claimedAt");

-- CreateIndex
CREATE INDEX "AlertEvent_workspaceId_flushId_idx" ON "AlertEvent"("workspaceId", "flushId");
