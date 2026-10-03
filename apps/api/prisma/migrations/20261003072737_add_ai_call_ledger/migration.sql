-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "appId" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCall_workspaceId_createdAt_idx" ON "AiCall"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCall_status_createdAt_idx" ON "AiCall"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AiCall" ADD CONSTRAINT "AiCall_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCall" ADD CONSTRAINT "AiCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "AiCall" TO asobeast_app;

ALTER TABLE "AiCall" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiCall" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AiCall"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
