-- AlterTable
ALTER TABLE "App" ADD COLUMN     "autoTrackRanked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "KeywordDiscovery" (
    "appId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "relevance" INTEGER NOT NULL,
    "position" INTEGER,
    "depth" INTEGER,
    "checkedOn" DATE,
    "queuedAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordDiscovery_pkey" PRIMARY KEY ("appId","keywordId")
);

-- CreateIndex
CREATE INDEX "KeywordDiscovery_workspaceId_idx" ON "KeywordDiscovery"("workspaceId");

-- CreateIndex
CREATE INDEX "KeywordDiscovery_keywordId_idx" ON "KeywordDiscovery"("keywordId");

-- CreateIndex
CREATE INDEX "KeywordDiscovery_appId_seenAt_idx" ON "KeywordDiscovery"("appId", "seenAt");

-- AddForeignKey
ALTER TABLE "KeywordDiscovery" ADD CONSTRAINT "KeywordDiscovery_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordDiscovery" ADD CONSTRAINT "KeywordDiscovery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordDiscovery" ADD CONSTRAINT "KeywordDiscovery_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KeywordDiscovery" ADD CONSTRAINT "KeywordDiscovery_observation_check"
  CHECK (("depth" IS NULL) = ("checkedOn" IS NULL)
    AND ("position" IS NULL OR ("depth" IS NOT NULL AND "position" >= 1 AND "position" <= "depth")));

GRANT SELECT, INSERT, UPDATE, DELETE ON "KeywordDiscovery" TO asobeast_app;

ALTER TABLE "KeywordDiscovery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KeywordDiscovery" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KeywordDiscovery"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
