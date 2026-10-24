-- CreateTable
CREATE TABLE "AppAnnotation" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "market" TEXT,
    "tag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppAnnotation_appId_date_idx" ON "AppAnnotation"("appId", "date");

-- AddForeignKey
ALTER TABLE "AppAnnotation" ADD CONSTRAINT "AppAnnotation_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "AppAnnotation" TO asobeast_app;

ALTER TABLE "AppAnnotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppAnnotation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AppAnnotation"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "App" a
      WHERE a."id" = "AppAnnotation"."appId"
        AND a."workspaceId" = app_current_workspace()
    )
  );
