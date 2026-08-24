-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "appId" TEXT,
    "dedupeKey" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flushedAt" TIMESTAMP(3),

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_dedupeKey_key" ON "AlertEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "AlertEvent_workspaceId_flushedAt_idx" ON "AlertEvent"("workspaceId", "flushedAt");

-- CreateIndex
CREATE INDEX "AlertEvent_createdAt_idx" ON "AlertEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
