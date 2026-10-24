-- AlterTable
ALTER TABLE "StoreConnection" ADD COLUMN     "bucket" TEXT;

-- CreateTable
CREATE TABLE "StoreFunnelSearchTerm" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "term" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "acquisitions" INTEGER NOT NULL DEFAULT 0,
    "generation" TEXT NOT NULL,

    CONSTRAINT "StoreFunnelSearchTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreFunnelSearchTerm_appId_normalized_idx" ON "StoreFunnelSearchTerm"("appId", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFunnelSearchTerm_appId_month_term_key" ON "StoreFunnelSearchTerm"("appId", "month", "term");

-- AddForeignKey
ALTER TABLE "StoreFunnelSearchTerm" ADD CONSTRAINT "StoreFunnelSearchTerm_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFunnelSearchTerm" ADD CONSTRAINT "StoreFunnelSearchTerm_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "StoreFunnelSearchTerm" TO asobeast_app;

ALTER TABLE "StoreFunnelSearchTerm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreFunnelSearchTerm" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StoreFunnelSearchTerm"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
