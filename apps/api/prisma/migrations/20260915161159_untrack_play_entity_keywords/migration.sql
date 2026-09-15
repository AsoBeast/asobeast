UPDATE "TrackedKeyword" AS "tracked"
SET "active" = false
FROM "App" AS "app", "Keyword" AS "keyword",
  LATERAL (
    SELECT "snapshot"."summary", "snapshot"."raw"
    FROM "AppSnapshot" AS "snapshot"
    WHERE "snapshot"."appId" = "app"."id"
    ORDER BY "snapshot"."capturedAt" DESC
    LIMIT 1
  ) AS "latest"
WHERE "app"."id" = "tracked"."appId"
  AND "keyword"."id" = "tracked"."keywordId"
  AND "app"."store" = 'GOOGLE_PLAY'
  AND "app"."isCompetitor" = false
  AND "tracked"."source" = 'DESCRIPTION'
  AND "tracked"."active" = true
  AND split_part("keyword"."text", ' ', 1) IN ('amp', 'quot', 'lt', 'gt', 'apos', '39')
  AND "latest"."raw"->>'summary' ~ '&(amp|lt|gt|quot|apos|#39);'
  AND position(
    ' ' || "keyword"."text" || ' '
    IN ' ' || trim(regexp_replace(lower(coalesce("latest"."summary", '')), '[^[:alpha:][:digit:]]+', ' ', 'g')) || ' '
  ) = 0;
