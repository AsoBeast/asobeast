UPDATE "App" AS "padded"
SET "storeAppId" = regexp_replace("padded"."storeAppId", '^0+(?=[0-9])', '')
WHERE "padded"."store" = 'APP_STORE'
  AND "padded"."storeAppId" ~ '^0+[0-9]'
  AND NOT EXISTS (
    SELECT 1
    FROM "App" AS "canonical"
    WHERE "canonical"."workspaceId" = "padded"."workspaceId"
      AND "canonical"."store" = "padded"."store"
      AND "canonical"."country" = "padded"."country"
      AND "canonical"."storeAppId" = regexp_replace("padded"."storeAppId", '^0+(?=[0-9])', '')
  );
