-- CreateTable
CREATE TABLE "KeywordInspection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "traffic" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "resultCount" INTEGER,
    "scoringSource" TEXT,
    "formulaVersion" TEXT,
    "confidence" TEXT,
    "stats" JSONB,
    "results" JSONB,
    "suggestions" JSONB,
    "failure" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "KeywordInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordInspection_workspaceId_requestedAt_idx" ON "KeywordInspection"("workspaceId", "requestedAt");

-- CreateIndex
CREATE INDEX "KeywordInspection_workspaceId_keywordId_requestedAt_idx" ON "KeywordInspection"("workspaceId", "keywordId", "requestedAt");

-- CreateIndex
CREATE INDEX "KeywordInspection_keywordId_idx" ON "KeywordInspection"("keywordId");

-- AddForeignKey
ALTER TABLE "KeywordInspection" ADD CONSTRAINT "KeywordInspection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordInspection" ADD CONSTRAINT "KeywordInspection_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KeywordInspection" ADD CONSTRAINT "KeywordInspection_status_check"
  CHECK ("status" IN ('PENDING', 'DONE', 'FAILED'));

GRANT SELECT, INSERT, UPDATE, DELETE ON "KeywordInspection" TO asobeast_app;

ALTER TABLE "KeywordInspection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KeywordInspection" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KeywordInspection"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
