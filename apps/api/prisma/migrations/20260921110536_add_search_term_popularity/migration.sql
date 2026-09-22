-- CreateTable
CREATE TABLE "SearchTermPopularity" (
    "country" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "week" DATE NOT NULL,
    "genre" TEXT NOT NULL,
    "rankInGenre" INTEGER,
    "popularity" INTEGER NOT NULL,
    "popularityInGenre" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchTermPopularity_pkey" PRIMARY KEY ("country","term","week","genre")
);

-- CreateIndex
CREATE INDEX "SearchTermPopularity_country_week_idx" ON "SearchTermPopularity"("country", "week");

GRANT SELECT, INSERT, UPDATE, DELETE ON "SearchTermPopularity" TO asobeast_app;
