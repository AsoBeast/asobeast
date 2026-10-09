UPDATE "ChangeEvent" AS "event"
SET
  "before" = CASE WHEN "source"."before_is_genre" THEN NULL ELSE "event"."before" END,
  "after" = CASE WHEN "source"."after_is_genre" THEN NULL ELSE "event"."after" END
FROM (
  SELECT
    "event"."id",
    COALESCE(bool_or(
      "snapshot"."position" = 2
      AND "snapshot"."subtitle" = "event"."before"
      AND "snapshot"."raw" -> 'genres' @> jsonb_build_array("snapshot"."subtitle")
    ), false) AS "before_is_genre",
    COALESCE(bool_or(
      "snapshot"."position" = 1
      AND "snapshot"."subtitle" = "event"."after"
      AND "snapshot"."raw" -> 'genres' @> jsonb_build_array("snapshot"."subtitle")
    ), false) AS "after_is_genre"
  FROM "ChangeEvent" AS "event"
  JOIN "App" ON "App"."id" = "event"."appId"
  CROSS JOIN LATERAL (
    SELECT
      "candidate"."subtitle",
      "candidate"."raw",
      row_number() OVER (
        ORDER BY "candidate"."capturedAt" DESC, "candidate"."id" DESC
      ) AS "position"
    FROM "AppSnapshot" AS "candidate"
    WHERE "candidate"."appId" = "event"."appId"
      AND "candidate"."country" IS NOT DISTINCT FROM "event"."country"
      AND "candidate"."localization" IS NOT DISTINCT FROM "event"."localization"
      AND "candidate"."capturedAt" <= "event"."capturedAt"
    ORDER BY "candidate"."capturedAt" DESC, "candidate"."id" DESC
    LIMIT 2
  ) AS "snapshot"
  WHERE "App"."store" = 'APP_STORE'
    AND "event"."field" = 'subtitle'
  GROUP BY "event"."id"
) AS "source"
WHERE "source"."id" = "event"."id"
  AND ("source"."before_is_genre" OR "source"."after_is_genre");

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
