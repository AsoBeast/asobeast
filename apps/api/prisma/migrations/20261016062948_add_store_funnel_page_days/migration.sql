-- AlterTable
ALTER TABLE "StoreReportRequest" ADD COLUMN     "detailedLastProcessingDate" DATE,
ADD COLUMN     "detailedReportId" TEXT;

-- CreateTable
CREATE TABLE "StoreFunnelPageDay" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "territory" TEXT NOT NULL,
    "country" TEXT,
    "pageTitle" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "uniqueImpressions" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "uniquePageViews" INTEGER NOT NULL DEFAULT 0,
    "gets" INTEGER NOT NULL DEFAULT 0,
    "uniqueGets" INTEGER NOT NULL DEFAULT 0,
    "processingDate" DATE NOT NULL,

    CONSTRAINT "StoreFunnelPageDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreFunnelPageDay_appId_country_date_idx" ON "StoreFunnelPageDay"("appId", "country", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFunnelPageDay_appId_date_territory_pageTitle_key" ON "StoreFunnelPageDay"("appId", "date", "territory", "pageTitle");

-- AddForeignKey
ALTER TABLE "StoreFunnelPageDay" ADD CONSTRAINT "StoreFunnelPageDay_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFunnelPageDay" ADD CONSTRAINT "StoreFunnelPageDay_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "StoreFunnelPageDay" TO asobeast_app;

ALTER TABLE "StoreFunnelPageDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreFunnelPageDay" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StoreFunnelPageDay"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
