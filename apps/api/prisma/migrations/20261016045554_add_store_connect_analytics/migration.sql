-- CreateTable
CREATE TABLE "StoreConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "issuerId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "keyFingerprint" TEXT NOT NULL,
    "credentialCiphertext" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reportAccess" TEXT NOT NULL DEFAULT 'unknown',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "StoreConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreReportRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "accessType" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'requested',
    "remoteId" TEXT,
    "reportId" TEXT,
    "lastProcessingDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreReportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreReportInstance" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "granularity" TEXT NOT NULL,
    "processingDate" DATE NOT NULL,
    "raw" BYTEA NOT NULL,
    "sizeInBytes" INTEGER NOT NULL,
    "segments" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "StoreReportInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreFunnelDay" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "territory" TEXT NOT NULL,
    "country" TEXT,
    "sourceType" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "uniqueImpressions" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "uniquePageViews" INTEGER NOT NULL DEFAULT 0,
    "gets" INTEGER NOT NULL DEFAULT 0,
    "uniqueGets" INTEGER NOT NULL DEFAULT 0,
    "processingDate" DATE NOT NULL,

    CONSTRAINT "StoreFunnelDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreConnection_workspaceId_store_key" ON "StoreConnection"("workspaceId", "store");

-- CreateIndex
CREATE UNIQUE INDEX "StoreReportRequest_appId_accessType_key" ON "StoreReportRequest"("appId", "accessType");

-- CreateIndex
CREATE INDEX "StoreReportInstance_workspaceId_fetchedAt_idx" ON "StoreReportInstance"("workspaceId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreReportInstance_requestId_remoteId_key" ON "StoreReportInstance"("requestId", "remoteId");

-- CreateIndex
CREATE INDEX "StoreFunnelDay_appId_country_date_idx" ON "StoreFunnelDay"("appId", "country", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFunnelDay_appId_date_territory_sourceType_pageType_key" ON "StoreFunnelDay"("appId", "date", "territory", "sourceType", "pageType");

-- AddForeignKey
ALTER TABLE "StoreConnection" ADD CONSTRAINT "StoreConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreConnection" ADD CONSTRAINT "StoreConnection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReportRequest" ADD CONSTRAINT "StoreReportRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReportRequest" ADD CONSTRAINT "StoreReportRequest_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "StoreConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReportRequest" ADD CONSTRAINT "StoreReportRequest_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReportInstance" ADD CONSTRAINT "StoreReportInstance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReportInstance" ADD CONSTRAINT "StoreReportInstance_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StoreReportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFunnelDay" ADD CONSTRAINT "StoreFunnelDay_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFunnelDay" ADD CONSTRAINT "StoreFunnelDay_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "StoreConnection" TO asobeast_app;

ALTER TABLE "StoreConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreConnection" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StoreConnection"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

GRANT SELECT, INSERT, UPDATE, DELETE ON "StoreReportRequest" TO asobeast_app;

ALTER TABLE "StoreReportRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreReportRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StoreReportRequest"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

GRANT SELECT, INSERT, UPDATE, DELETE ON "StoreReportInstance" TO asobeast_app;

ALTER TABLE "StoreReportInstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreReportInstance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StoreReportInstance"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

GRANT SELECT, INSERT, UPDATE, DELETE ON "StoreFunnelDay" TO asobeast_app;

ALTER TABLE "StoreFunnelDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreFunnelDay" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StoreFunnelDay"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
