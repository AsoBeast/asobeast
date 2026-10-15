-- AlterTable
ALTER TABLE "App" ADD COLUMN     "replyGuidelines" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "replyText" TEXT;

-- CreateTable
CREATE TABLE "ReviewReply" (
    "reviewId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tone" TEXT,
    "model" TEXT,
    "generatedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewReply_pkey" PRIMARY KEY ("reviewId")
);

-- CreateIndex
CREATE INDEX "ReviewReply_appId_repliedAt_idx" ON "ReviewReply"("appId", "repliedAt");

-- CreateIndex
CREATE INDEX "ReviewReply_workspaceId_idx" ON "ReviewReply"("workspaceId");

-- AddForeignKey
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "ReviewReply" TO asobeast_app;

ALTER TABLE "ReviewReply" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewReply" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ReviewReply"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
