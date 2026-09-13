UPDATE "TrackedKeyword"
SET "fieldOrder" = NULL
WHERE "fieldOrder" IS NOT NULL
  AND ("active" = false OR "source" <> 'KEYWORD_FIELD');

UPDATE "TrackedKeyword" AS "tracked"
SET "fieldOrder" = "ordered"."position"
FROM (
  SELECT
    "appId",
    "keywordId",
    ROW_NUMBER() OVER (
      PARTITION BY "appId"
      ORDER BY "fieldOrder" ASC NULLS LAST, "createdAt" ASC, "keywordId" ASC
    ) - 1 AS "position"
  FROM "TrackedKeyword"
  WHERE "active" = true
    AND "source" = 'KEYWORD_FIELD'
) AS "ordered"
WHERE "tracked"."appId" = "ordered"."appId"
  AND "tracked"."keywordId" = "ordered"."keywordId";
