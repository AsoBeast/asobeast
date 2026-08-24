-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "keywordId" TEXT,
    "rule" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "country" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL,
    "impact" INTEGER NOT NULL,
    "formulaVersion" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "aiExplanation" TEXT,
    "aiModel" TEXT,
    "aiGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionItem_workspaceId_status_priority_idx" ON "ActionItem"("workspaceId", "status", "priority");

-- CreateIndex
CREATE INDEX "ActionItem_appId_status_idx" ON "ActionItem"("appId", "status");

-- CreateIndex
CREATE INDEX "ActionItem_workspaceId_status_lastSeenAt_idx" ON "ActionItem"("workspaceId", "status", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActionItem_workspaceId_fingerprint_key" ON "ActionItem"("workspaceId", "fingerprint");

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
