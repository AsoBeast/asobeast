-- CreateTable
CREATE TABLE "SupportAccess" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportAccess_workspaceId_createdAt_idx" ON "SupportAccess"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportAccess_createdAt_idx" ON "SupportAccess"("createdAt");

GRANT SELECT, INSERT, UPDATE, DELETE ON "SupportAccess" TO asobeast_app;

ALTER TABLE "SupportAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportAccess" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "SupportAccess"
  USING (app_tenancy_bypassed());
