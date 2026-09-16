UPDATE "TrackedKeyword" AS "tracked"
SET "active" = false
FROM "App" AS "app", "Keyword" AS "keyword"
WHERE "app"."id" = "tracked"."appId"
  AND "keyword"."id" = "tracked"."keywordId"
  AND "app"."store" = 'GOOGLE_PLAY'
  AND "app"."isCompetitor" = false
  AND "tracked"."source" = 'DESCRIPTION'
  AND "tracked"."active" = true
  AND split_part("keyword"."text", ' ', 1) IN ('amp', 'quot', 'lt', 'gt', 'apos', '39')
  AND EXISTS (
    SELECT 1
    FROM "AppSnapshot" AS "snapshot"
    WHERE "snapshot"."appId" = "app"."id"
      AND "snapshot"."raw"->>'summary' ~ '&(amp|lt|gt|quot|apos|#39);'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "AppSnapshot" AS "snapshot"
    WHERE "snapshot"."appId" = "app"."id"
      AND position(
        ' ' || "keyword"."text" || ' '
        IN ' ' || trim(regexp_replace(lower(coalesce("snapshot"."summary", '')), '[^[:alpha:][:digit:]]+', ' ', 'g')) || ' '
      ) > 0
  );
