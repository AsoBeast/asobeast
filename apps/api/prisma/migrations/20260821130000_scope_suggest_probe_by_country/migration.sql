-- AlterTable
ALTER TABLE "SuggestProbe" DROP CONSTRAINT "SuggestProbe_pkey",
ADD COLUMN     "country" TEXT;

UPDATE "SuggestProbe"
SET "country" = "App"."country"
FROM "App"
WHERE "App"."id" = "SuggestProbe"."appId";

DELETE FROM "SuggestProbe" WHERE "country" IS NULL;

ALTER TABLE "SuggestProbe" ALTER COLUMN "country" SET NOT NULL,
ADD CONSTRAINT "SuggestProbe_pkey" PRIMARY KEY ("appId", "term", "country", "day", "probe");
