DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TrackedKeyword" AS "tracked"
    JOIN "Keyword" AS "keyword" ON "keyword"."id" = "tracked"."keywordId"
    WHERE "tracked"."fieldOrder" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "KeywordField" AS "field"
        WHERE "field"."appId" = "tracked"."appId"
          AND "keyword"."text" = ANY ("field"."phrases")
      )
  ) THEN
    RAISE EXCEPTION 'TrackedKeyword.fieldOrder holds keyword field phrases that no KeywordField row carries; the column is kept so they are not lost. Copy or clear those rows, then run prisma migrate resolve --rolled-back 20261013184212_drop_tracked_keyword_field_order';
  END IF;
END;
$$;

ALTER TABLE "TrackedKeyword" DROP COLUMN "fieldOrder";
