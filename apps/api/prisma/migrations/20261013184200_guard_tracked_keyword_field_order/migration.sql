DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'TrackedKeyword'
      AND column_name = 'fieldOrder'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "TrackedKeyword" AS "tracked"
    JOIN "App" AS "app" ON "app"."id" = "tracked"."appId"
    JOIN "Keyword" AS "keyword" ON "keyword"."id" = "tracked"."keywordId"
    WHERE "tracked"."fieldOrder" IS NOT NULL
      AND NOT (
        "app"."store" = 'APP_STORE'
        AND "keyword"."country" = "app"."country"
        AND EXISTS (
          SELECT 1
          FROM "KeywordField" AS "field"
          WHERE "field"."appId" = "tracked"."appId"
            AND "keyword"."text" = ANY ("field"."phrases")
        )
      )
  ) THEN
    RAISE EXCEPTION 'TrackedKeyword.fieldOrder holds keyword field phrases that no KeywordField row carries, such as those of a Google Play app or of a market other than the app''s own; the column is kept so they are not lost. Note the phrases worth keeping, set fieldOrder to NULL on those rows, then run prisma migrate resolve --rolled-back 20261013184200_guard_tracked_keyword_field_order';
  END IF;
END;
$$;
