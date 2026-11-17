ALTER TABLE "KeywordDiscovery" ADD COLUMN     "ownSearch" BOOLEAN NOT NULL DEFAULT false;

UPDATE "KeywordDiscovery" SET "ownSearch" = true WHERE "depth" >= 200;
