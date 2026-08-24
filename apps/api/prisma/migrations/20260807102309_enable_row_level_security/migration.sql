ALTER TABLE "KeywordRanking" ADD COLUMN "workspaceId" TEXT;

UPDATE "KeywordRanking" AS r
SET "workspaceId" = a."workspaceId"
FROM "App" AS a
WHERE a."id" = r."appId";

DELETE FROM "KeywordRanking" WHERE "workspaceId" IS NULL;

ALTER TABLE "KeywordRanking" ALTER COLUMN "workspaceId" SET NOT NULL;

CREATE INDEX "KeywordRanking_workspaceId_date_idx" ON "KeywordRanking"("workspaceId", "date");

ALTER TABLE "KeywordRanking" ADD CONSTRAINT "KeywordRanking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION app_current_workspace() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.workspace_id', true) $$;

CREATE OR REPLACE FUNCTION app_tenancy_bypassed() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.bypass_tenancy', true) = 'on' $$;

ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Workspace"
  USING (app_tenancy_bypassed() OR "id" = app_current_workspace());

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "User"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

ALTER TABLE "AppGroup" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AppGroup"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

ALTER TABLE "App" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "App"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

ALTER TABLE "Webhook" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Webhook"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

ALTER TABLE "EmailAlert" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "EmailAlert"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

ALTER TABLE "AlertEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AlertEvent"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

ALTER TABLE "ActionItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ActionItem"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

ALTER TABLE "KeywordRanking" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KeywordRanking"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());

ALTER TABLE "ApiToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ApiToken"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "User" u
      WHERE u."id" = "ApiToken"."userId"
        AND u."workspaceId" = app_current_workspace()
    )
  );

ALTER TABLE "AppSnapshot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AppSnapshot"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "App" a
      WHERE a."id" = "AppSnapshot"."appId"
        AND a."workspaceId" = app_current_workspace()
    )
  );

ALTER TABLE "TrackedKeyword" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TrackedKeyword"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "App" a
      WHERE a."id" = "TrackedKeyword"."appId"
        AND a."workspaceId" = app_current_workspace()
    )
  );

ALTER TABLE "AuditInsight" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditInsight"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "App" a
      WHERE a."id" = "AuditInsight"."appId"
        AND a."workspaceId" = app_current_workspace()
    )
  );

ALTER TABLE "CategoryRank" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CategoryRank"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "App" a
      WHERE a."id" = "CategoryRank"."appId"
        AND a."workspaceId" = app_current_workspace()
    )
  );

ALTER TABLE "ChangeEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ChangeEvent"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "App" a
      WHERE a."id" = "ChangeEvent"."appId"
        AND a."workspaceId" = app_current_workspace()
    )
  );

ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Review"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "App" a
      WHERE a."id" = "Review"."appId"
        AND a."workspaceId" = app_current_workspace()
    )
  );

ALTER TABLE "SuggestProbe" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SuggestProbe"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "App" a
      WHERE a."id" = "SuggestProbe"."appId"
        AND a."workspaceId" = app_current_workspace()
    )
  );

ALTER TABLE "AuditScore" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditScore"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "App" a
      WHERE a."id" = "AuditScore"."appId"
        AND a."workspaceId" = app_current_workspace()
    )
  );

ALTER TABLE "AlertDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AlertDelivery"
  USING (
    app_tenancy_bypassed()
    OR EXISTS (
      SELECT 1 FROM "Webhook" w
      WHERE w."id" = "AlertDelivery"."webhookId"
        AND w."workspaceId" = app_current_workspace()
    )
    OR EXISTS (
      SELECT 1 FROM "EmailAlert" e
      WHERE e."id" = "AlertDelivery"."emailAlertId"
        AND e."workspaceId" = app_current_workspace()
    )
  );
