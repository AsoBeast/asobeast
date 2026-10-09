UPDATE "ChangeEvent" AS "event"
SET "before" = NULL
FROM "AppSnapshot" AS "snapshot", "App"
WHERE "App"."id" = "snapshot"."appId"
  AND "App"."store" = 'APP_STORE'
  AND "event"."field" = 'subtitle'
  AND "snapshot"."appId" = "event"."appId"
  AND "snapshot"."country" IS NOT DISTINCT FROM "event"."country"
  AND "snapshot"."localization" IS NOT DISTINCT FROM "event"."localization"
  AND "snapshot"."raw" -> 'genres' @> jsonb_build_array("event"."before");

UPDATE "ChangeEvent" AS "event"
SET "after" = NULL
FROM "AppSnapshot" AS "snapshot", "App"
WHERE "App"."id" = "snapshot"."appId"
  AND "App"."store" = 'APP_STORE'
  AND "event"."field" = 'subtitle'
  AND "snapshot"."appId" = "event"."appId"
  AND "snapshot"."country" IS NOT DISTINCT FROM "event"."country"
  AND "snapshot"."localization" IS NOT DISTINCT FROM "event"."localization"
  AND "snapshot"."raw" -> 'genres' @> jsonb_build_array("event"."after");

DELETE FROM "ChangeEvent" AS "event"
USING "App"
WHERE "App"."id" = "event"."appId"
  AND "App"."store" = 'APP_STORE'
  AND "event"."field" = 'subtitle'
  AND "event"."before" IS NULL
  AND "event"."after" IS NULL;

UPDATE "AppSnapshot" AS "snapshot"
SET "subtitle" = NULL
FROM "App"
WHERE "App"."id" = "snapshot"."appId"
  AND "App"."store" = 'APP_STORE'
  AND "snapshot"."raw" -> 'genres' @> jsonb_build_array("snapshot"."subtitle");
