-- AlterTable
ALTER TABLE "AppSnapshot" ADD COLUMN     "ratingHistogram" JSONB;

UPDATE "AppSnapshot" AS s
SET "ratingHistogram" = jsonb_build_object(
  '1', (s."raw" -> 'histogram' ->> '1')::bigint,
  '2', (s."raw" -> 'histogram' ->> '2')::bigint,
  '3', (s."raw" -> 'histogram' ->> '3')::bigint,
  '4', (s."raw" -> 'histogram' ->> '4')::bigint,
  '5', (s."raw" -> 'histogram' ->> '5')::bigint
)
FROM "App" AS a
WHERE a."id" = s."appId"
  AND a."store" = 'GOOGLE_PLAY'
  AND s."country" IS NULL
  AND s."localization" IS NULL
  AND jsonb_typeof(s."raw" -> 'histogram') = 'object'
  AND (s."raw" -> 'histogram' ->> '1') ~ '^[0-9]{1,15}$'
  AND (s."raw" -> 'histogram' ->> '2') ~ '^[0-9]{1,15}$'
  AND (s."raw" -> 'histogram' ->> '3') ~ '^[0-9]{1,15}$'
  AND (s."raw" -> 'histogram' ->> '4') ~ '^[0-9]{1,15}$'
  AND (s."raw" -> 'histogram' ->> '5') ~ '^[0-9]{1,15}$';
