-- CreateTable
CREATE TABLE "ChartApp" (
    "id" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "storeAppId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "developer" TEXT,
    "iconUrl" TEXT,
    "genreId" TEXT,
    "free" BOOLEAN,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartCapture" (
    "id" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "country" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "depth" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartEntry" (
    "captureId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "chartAppId" TEXT NOT NULL,

    CONSTRAINT "ChartEntry_pkey" PRIMARY KEY ("captureId","position")
);

-- CreateTable
CREATE TABLE "ChartFollow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "country" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChartApp_store_storeAppId_key" ON "ChartApp"("store", "storeAppId");

-- CreateIndex
CREATE INDEX "ChartCapture_date_idx" ON "ChartCapture"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ChartCapture_store_country_collection_genre_device_date_key" ON "ChartCapture"("store", "country", "collection", "genre", "device", "date");

-- CreateIndex
CREATE INDEX "ChartEntry_chartAppId_idx" ON "ChartEntry"("chartAppId");

-- CreateIndex
CREATE INDEX "ChartFollow_workspaceId_idx" ON "ChartFollow"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartFollow_workspaceId_store_country_collection_genre_devi_key" ON "ChartFollow"("workspaceId", "store", "country", "collection", "genre", "device");

-- AddForeignKey
ALTER TABLE "ChartEntry" ADD CONSTRAINT "ChartEntry_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "ChartCapture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartEntry" ADD CONSTRAINT "ChartEntry_chartAppId_fkey" FOREIGN KEY ("chartAppId") REFERENCES "ChartApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartFollow" ADD CONSTRAINT "ChartFollow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "ChartApp" TO asobeast_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ChartCapture" TO asobeast_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ChartEntry" TO asobeast_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ChartFollow" TO asobeast_app;

ALTER TABLE "ChartFollow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChartFollow" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ChartFollow"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
