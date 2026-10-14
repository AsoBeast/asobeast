-- CreateTable
CREATE TABLE "AppSetup" (
    "appId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "skipped" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countriesReviewed" BOOLEAN NOT NULL DEFAULT false,
    "selectedMarkets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetup_pkey" PRIMARY KEY ("appId")
);

-- CreateIndex
CREATE INDEX "AppSetup_workspaceId_idx" ON "AppSetup"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetup_appId_workspaceId_key" ON "AppSetup"("appId", "workspaceId");

-- AddForeignKey
ALTER TABLE "AppSetup" ADD CONSTRAINT "AppSetup_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSetup" ADD CONSTRAINT "AppSetup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AppSetup" ("appId", "workspaceId", "status", "skipped", "countriesReviewed", "selectedMarkets", "createdAt", "updatedAt")
SELECT a."id", a."workspaceId", 'not_started', '{}', false, ARRAY[a."country"], a."createdAt", a."createdAt"
FROM "App" a
WHERE a."isCompetitor" = false
ON CONFLICT ("appId") DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON "AppSetup" TO asobeast_app;

ALTER TABLE "AppSetup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSetup" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AppSetup"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
