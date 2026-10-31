-- CreateTable
CREATE TABLE "KeywordFieldSync" (
    "appId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "version" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,

    CONSTRAINT "KeywordFieldSync_pkey" PRIMARY KEY ("appId","workspaceId")
);

-- CreateIndex
CREATE INDEX "KeywordFieldSync_workspaceId_idx" ON "KeywordFieldSync"("workspaceId");

-- AddForeignKey
ALTER TABLE "KeywordFieldSync" ADD CONSTRAINT "KeywordFieldSync_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "KeywordFieldSync" TO asobeast_app;

ALTER TABLE "KeywordFieldSync" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KeywordFieldSync" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KeywordFieldSync"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
