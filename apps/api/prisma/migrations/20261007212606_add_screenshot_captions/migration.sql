-- AlterTable
ALTER TABLE "ChangeEvent" ADD COLUMN     "detail" JSONB;

-- CreateTable
CREATE TABLE "SnapshotScreenshot" (
    "snapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "caption" TEXT,
    "recipe" TEXT,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "SnapshotScreenshot_pkey" PRIMARY KEY ("snapshotId","position")
);

-- CreateTable
CREATE TABLE "ScreenshotText" (
    "assetKey" TEXT NOT NULL,
    "recipe" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "caption" TEXT,
    "engine" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenshotText_pkey" PRIMARY KEY ("assetKey","recipe")
);

-- CreateIndex
CREATE INDEX "SnapshotScreenshot_workspaceId_idx" ON "SnapshotScreenshot"("workspaceId");

-- CreateIndex
CREATE INDEX "ScreenshotText_usedAt_idx" ON "ScreenshotText"("usedAt");

-- AddForeignKey
ALTER TABLE "SnapshotScreenshot" ADD CONSTRAINT "SnapshotScreenshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AppSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotScreenshot" ADD CONSTRAINT "SnapshotScreenshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "SnapshotScreenshot" TO asobeast_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ScreenshotText" TO asobeast_app;

ALTER TABLE "SnapshotScreenshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SnapshotScreenshot" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SnapshotScreenshot"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
