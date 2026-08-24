-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "deletionDueAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedBy" TEXT;

-- CreateIndex
CREATE INDEX "Workspace_deletionDueAt_idx" ON "Workspace"("deletionDueAt");
