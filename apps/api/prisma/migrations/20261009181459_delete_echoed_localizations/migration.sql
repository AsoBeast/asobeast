WITH "stored" AS (
  SELECT
    "snapshot"."appId",
    "snapshot"."country",
    "snapshot"."localization",
    EXISTS (
      SELECT 1
      FROM (
        SELECT "title", "subtitle", "description", "raw"
        FROM "AppSnapshot" AS "default"
        WHERE "default"."appId" = "snapshot"."appId"
          AND "default"."country" IS NOT DISTINCT FROM "snapshot"."country"
          AND "default"."localization" IS NULL
          AND "default"."capturedAt" <= "snapshot"."capturedAt"
        ORDER BY "default"."capturedAt" DESC, "default"."id" DESC
        LIMIT 1
      ) AS "fallback"
      WHERE "fallback"."title" = "snapshot"."title"
        AND "fallback"."description" = "snapshot"."description"
        AND "fallback"."raw" -> 'screenshots' IS NOT DISTINCT FROM "snapshot"."raw" -> 'screenshots'
        AND NULLIF(btrim("fallback"."raw" ->> 'releaseNotes'), '') IS NOT DISTINCT FROM NULLIF(btrim("snapshot"."raw" ->> 'releaseNotes'), '')
        AND (
          "snapshot"."subtitle" IS NULL
          OR "snapshot"."subtitle" IS NOT DISTINCT FROM "fallback"."subtitle"
          OR "snapshot"."raw" -> 'genres' @> jsonb_build_array("snapshot"."subtitle")
        )
    ) AS "echoesDefault"
  FROM "AppSnapshot" AS "snapshot"
  INNER JOIN "App" ON "App"."id" = "snapshot"."appId"
  WHERE "App"."store" = 'APP_STORE'
    AND "snapshot"."localization" IS NOT NULL
),
"echoed" AS (
  SELECT "appId", "country", "localization"
  FROM "stored"
  GROUP BY "appId", "country", "localization"
  HAVING bool_and("echoesDefault")
),
"droppedEvents" AS (
  DELETE FROM "ChangeEvent" AS "event"
  USING "echoed"
  WHERE "event"."appId" = "echoed"."appId"
    AND "event"."country" IS NOT DISTINCT FROM "echoed"."country"
    AND "event"."localization" = "echoed"."localization"
)
DELETE FROM "AppSnapshot" AS "snapshot"
USING "echoed"
WHERE "snapshot"."appId" = "echoed"."appId"
  AND "snapshot"."country" IS NOT DISTINCT FROM "echoed"."country"
  AND "snapshot"."localization" = "echoed"."localization";
