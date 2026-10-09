DELETE FROM "TrackedKeyword" AS "tracked"
USING "Keyword" AS "keyword", "App"
WHERE "keyword"."id" = "tracked"."keywordId"
  AND "App"."id" = "tracked"."appId"
  AND "App"."store" = 'APP_STORE'
  AND "tracked"."source" = 'SUBTITLE'
  AND cardinality("tracked"."tags") = 0
  AND "tracked"."note" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "AppSnapshot" AS "snapshot"
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof("snapshot"."raw" -> 'genres') = 'array' THEN "snapshot"."raw" -> 'genres'
        ELSE '[]'::jsonb
      END
    ) AS "genre"("name")
    WHERE "snapshot"."appId" = "tracked"."appId"
      AND (
        "keyword"."text" = lower("genre"."name")
        OR "keyword"."text" = ANY (regexp_split_to_array(lower("genre"."name"), '[[:space:]:.,|&]+'))
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "AppSnapshot" AS "snapshot"
    WHERE "snapshot"."appId" = "tracked"."appId"
      AND (
        position("keyword"."text" IN lower("snapshot"."title")) > 0
        OR position("keyword"."text" IN lower(coalesce("snapshot"."subtitle", ''))) > 0
      )
  );
