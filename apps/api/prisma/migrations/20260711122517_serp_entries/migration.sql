-- CreateTable
CREATE TABLE "SerpEntry" (
    "keywordId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "position" INTEGER NOT NULL,
    "storeAppId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "developer" TEXT,
    "ratingAvg" DOUBLE PRECISION,
    "ratingCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerpEntry_pkey" PRIMARY KEY ("keywordId","date","position")
);

-- CreateIndex
CREATE INDEX "SerpEntry_storeAppId_date_idx" ON "SerpEntry"("storeAppId", "date");

-- CreateIndex
CREATE INDEX "SerpEntry_keywordId_date_idx" ON "SerpEntry"("keywordId", "date");

-- AddForeignKey
ALTER TABLE "SerpEntry" ADD CONSTRAINT "SerpEntry_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
