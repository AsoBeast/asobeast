-- CreateTable
CREATE TABLE "KeywordField" (
    "appId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "localization" TEXT NOT NULL,
    "phrases" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordField_pkey" PRIMARY KEY ("appId","localization")
);

-- CreateIndex
CREATE INDEX "KeywordField_workspaceId_idx" ON "KeywordField"("workspaceId");

-- AddForeignKey
ALTER TABLE "KeywordField" ADD CONSTRAINT "KeywordField_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordField" ADD CONSTRAINT "KeywordField_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "KeywordField" ("appId", "workspaceId", "localization", "phrases", "updatedAt")
SELECT
  "tracked"."appId",
  "app"."workspaceId",
  CASE "app"."country"
    WHEN 'ar' THEN 'es-MX'
    WHEN 'at' THEN 'de'
    WHEN 'au' THEN 'en-AU'
    WHEN 'bo' THEN 'es-MX'
    WHEN 'br' THEN 'pt-BR'
    WHEN 'ca' THEN 'en-CA'
    WHEN 'ch' THEN 'de'
    WHEN 'ci' THEN 'fr'
    WHEN 'cl' THEN 'es-MX'
    WHEN 'cm' THEN 'fr'
    WHEN 'cn' THEN 'zh-Hans'
    WHEN 'co' THEN 'es-MX'
    WHEN 'cr' THEN 'es-MX'
    WHEN 'de' THEN 'de'
    WHEN 'do' THEN 'es-MX'
    WHEN 'ec' THEN 'es-MX'
    WHEN 'es' THEN 'es-ES'
    WHEN 'fr' THEN 'fr'
    WHEN 'ga' THEN 'fr'
    WHEN 'gt' THEN 'es-MX'
    WHEN 'hk' THEN 'zh-Hant'
    WHEN 'hn' THEN 'es-MX'
    WHEN 'it' THEN 'it'
    WHEN 'jp' THEN 'ja'
    WHEN 'kr' THEN 'ko'
    WHEN 'mo' THEN 'zh-Hant'
    WHEN 'mx' THEN 'es-MX'
    WHEN 'ni' THEN 'es-MX'
    WHEN 'nl' THEN 'nl'
    WHEN 'nz' THEN 'en-AU'
    WHEN 'pa' THEN 'es-MX'
    WHEN 'pe' THEN 'es-MX'
    WHEN 'pt' THEN 'pt-PT'
    WHEN 'py' THEN 'es-MX'
    WHEN 'ru' THEN 'ru'
    WHEN 'se' THEN 'sv'
    WHEN 'sv' THEN 'es-MX'
    WHEN 'tw' THEN 'zh-Hant'
    WHEN 'us' THEN 'en-US'
    WHEN 've' THEN 'es-MX'
    ELSE 'en-GB'
  END,
  ARRAY_AGG("keyword"."text" ORDER BY "tracked"."fieldOrder", "tracked"."createdAt", "tracked"."keywordId"),
  MAX("tracked"."createdAt")
FROM "TrackedKeyword" AS "tracked"
JOIN "App" AS "app" ON "app"."id" = "tracked"."appId"
JOIN "Keyword" AS "keyword" ON "keyword"."id" = "tracked"."keywordId"
WHERE "tracked"."fieldOrder" IS NOT NULL
  AND "app"."store" = 'APP_STORE'
  AND "keyword"."country" = "app"."country"
GROUP BY "tracked"."appId", "app"."workspaceId", "app"."country";

GRANT SELECT, INSERT, UPDATE, DELETE ON "KeywordField" TO asobeast_app;

ALTER TABLE "KeywordField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KeywordField" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KeywordField"
  USING (app_tenancy_bypassed() OR "workspaceId" = app_current_workspace());
