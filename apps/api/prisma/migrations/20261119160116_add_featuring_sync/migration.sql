-- CreateTable
CREATE TABLE "FeaturingSync" (
    "appId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "draftNominations" INTEGER NOT NULL DEFAULT 0,
    "submittedNominations" INTEGER NOT NULL DEFAULT 0,
    "submittedDate" TIMESTAMP(3),
    "publishStartDate" TIMESTAMP(3),
    "publishEndDate" TIMESTAMP(3),
    "promoFilled" INTEGER NOT NULL DEFAULT 0,
    "promoTotal" INTEGER NOT NULL DEFAULT 0,
    "roleRefused" BOOLEAN NOT NULL DEFAULT false,
    "nominationsError" TEXT,
    "promoError" TEXT,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "FeaturingSync_pkey" PRIMARY KEY ("appId","workspaceId")
);

-- CreateIndex
CREATE INDEX "FeaturingSync_workspaceId_idx" ON "FeaturingSync"("workspaceId");

-- AddForeignKey
ALTER TABLE "FeaturingSync" ADD CONSTRAINT "FeaturingSync_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "FeaturingSync" TO asobeast_app;

ALTER TABLE "FeaturingSync" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeaturingSync" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FeaturingSync"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
