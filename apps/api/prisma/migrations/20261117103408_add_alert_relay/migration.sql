-- CreateTable
CREATE TABLE "AlertRelay" (
    "alertEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRelay_pkey" PRIMARY KEY ("alertEventId")
);

-- CreateIndex
CREATE INDEX "AlertRelay_workspaceId_createdAt_idx" ON "AlertRelay"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "AlertRelay" ADD CONSTRAINT "AlertRelay_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRelay" ADD CONSTRAINT "AlertRelay_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "AlertRelay" TO asobeast_app;

ALTER TABLE "AlertRelay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AlertRelay" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AlertRelay"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
