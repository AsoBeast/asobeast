WITH "padded" AS (
  SELECT
    "id",
    "workspaceId",
    "store",
    "country",
    regexp_replace("storeAppId", '^0+(?=[0-9])', '') AS "canonicalId",
    row_number() OVER (
      PARTITION BY "workspaceId", "store", "country", regexp_replace("storeAppId", '^0+(?=[0-9])', '')
      ORDER BY "createdAt", "id"
    ) AS "rank"
  FROM "App"
  WHERE "store" = 'APP_STORE'
    AND "storeAppId" ~ '^0+[0-9]'
)
UPDATE "App" AS "app"
SET "storeAppId" = "padded"."canonicalId"
FROM "padded"
WHERE "app"."id" = "padded"."id"
  AND "padded"."rank" = 1
  AND NOT EXISTS (
    SELECT 1 FROM "App" AS "canonical"
    WHERE "canonical"."workspaceId" = "padded"."workspaceId"
      AND "canonical"."store" = "padded"."store"
      AND "canonical"."country" = "padded"."country"
      AND "canonical"."storeAppId" = "padded"."canonicalId"
  );
