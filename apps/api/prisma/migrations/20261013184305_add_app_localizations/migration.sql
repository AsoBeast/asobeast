-- CreateTable
CREATE TABLE "AppLocalization" (
    "appId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "localization" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppLocalization_pkey" PRIMARY KEY ("appId","localization")
);

-- CreateIndex
CREATE INDEX "AppLocalization_workspaceId_idx" ON "AppLocalization"("workspaceId");

-- AddForeignKey
ALTER TABLE "AppLocalization" ADD CONSTRAINT "AppLocalization_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppLocalization" ADD CONSTRAINT "AppLocalization_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AppLocalization" ("appId", "workspaceId", "localization", "origin", "createdAt")
SELECT f."appId", f."workspaceId", f."localization", 'manual', f."updatedAt"
FROM "KeywordField" f
ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON "AppLocalization" TO asobeast_app;

ALTER TABLE "AppLocalization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppLocalization" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AppLocalization"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
