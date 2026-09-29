-- CreateTable
CREATE TABLE "ActionEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "impact" INTEGER NOT NULL,
    "snoozedUntil" TIMESTAMP(3),
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionEvent_actionId_occurredAt_idx" ON "ActionEvent"("actionId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActionEvent_workspaceId_occurredAt_idx" ON "ActionEvent"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActionEvent_appId_occurredAt_idx" ON "ActionEvent"("appId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActionItem_id_workspaceId_key" ON "ActionItem"("id", "workspaceId");

-- AddForeignKey
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_actionId_workspaceId_fkey" FOREIGN KEY ("actionId", "workspaceId") REFERENCES "ActionItem"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


INSERT INTO "ActionEvent" ("id", "workspaceId", "actionId", "appId", "type", "actor", "status", "priority", "impact", "occurredAt")
SELECT 'bf_' || i."id" || '_o', i."workspaceId", i."id", i."appId", 'opened', 'system', 'OPEN', i."priority", i."impact", i."firstSeenAt"
FROM "ActionItem" AS i;

INSERT INTO "ActionEvent" ("id", "workspaceId", "actionId", "appId", "type", "actor", "status", "priority", "impact", "occurredAt")
SELECT 'bf_' || i."id" || '_c', i."workspaceId", i."id", i."appId", CASE WHEN i."status" = 'DONE' THEN 'done' ELSE 'dismissed' END, 'user', i."status", i."priority", i."impact", i."closedAt"
FROM "ActionItem" AS i
WHERE i."status" IN ('DONE', 'DISMISSED') AND i."closedAt" IS NOT NULL;

INSERT INTO "ActionEvent" ("id", "workspaceId", "actionId", "appId", "type", "actor", "status", "priority", "impact", "occurredAt")
SELECT 'bf_' || i."id" || '_r', i."workspaceId", i."id", i."appId", 'resolved', 'system', 'RESOLVED', i."priority", i."impact", i."resolvedAt"
FROM "ActionItem" AS i
WHERE i."status" = 'RESOLVED' AND i."resolvedAt" IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON "ActionEvent" TO asobeast_app;

ALTER TABLE "ActionEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActionEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ActionEvent"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
