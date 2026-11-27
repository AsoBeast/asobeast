-- CreateTable
CREATE TABLE "ListingTarget" (
    "appId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "localization" TEXT NOT NULL,
    "slots" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingTarget_pkey" PRIMARY KEY ("appId","localization")
);

-- CreateIndex
CREATE INDEX "ListingTarget_workspaceId_idx" ON "ListingTarget"("workspaceId");

-- AddForeignKey
ALTER TABLE "ListingTarget" ADD CONSTRAINT "ListingTarget_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingTarget" ADD CONSTRAINT "ListingTarget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "ListingTarget" TO asobeast_app;

ALTER TABLE "ListingTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingTarget" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ListingTarget"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
