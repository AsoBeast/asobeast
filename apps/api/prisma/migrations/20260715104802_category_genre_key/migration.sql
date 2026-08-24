ALTER TABLE "CategoryRank" ADD COLUMN "genre" TEXT;
UPDATE "CategoryRank" SET "genre" = CASE WHEN "genreId" = 0 THEN 'overall' ELSE "genreId"::text END;
ALTER TABLE "CategoryRank" ALTER COLUMN "genre" SET NOT NULL;
ALTER TABLE "CategoryRank" DROP CONSTRAINT "CategoryRank_pkey";
ALTER TABLE "CategoryRank" ADD CONSTRAINT "CategoryRank_pkey" PRIMARY KEY ("appId", "date", "collection", "genre");
ALTER TABLE "CategoryRank" DROP COLUMN "genreId";
