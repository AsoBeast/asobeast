-- AlterTable
ALTER TABLE "AlertEvent" ADD COLUMN     "keywordId" TEXT;

-- CreateIndex
CREATE INDEX "AlertEvent_workspaceId_createdAt_id_idx" ON "AlertEvent"("workspaceId", "createdAt" DESC, "id" DESC);
