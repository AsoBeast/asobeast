UPDATE "AppSnapshot" AS "snapshot"
SET "version" = NULL
FROM "App"
WHERE "App"."id" = "snapshot"."appId"
  AND "App"."store" = 'GOOGLE_PLAY'
  AND "snapshot"."version" = 'VARY';

UPDATE "ChangeEvent" AS "event"
SET "before" = NULLIF("event"."before", 'VARY'),
    "after" = NULLIF("event"."after", 'VARY')
FROM "App"
WHERE "App"."id" = "event"."appId"
  AND "App"."store" = 'GOOGLE_PLAY'
  AND "event"."field" = 'version'
  AND 'VARY' IN ("event"."before", "event"."after");
