-- CreateTable
CREATE TABLE "CategoryRank" (
    "appId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "collection" TEXT NOT NULL,
    "genreId" INTEGER NOT NULL,
    "position" INTEGER,
    "depth" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryRank_pkey" PRIMARY KEY ("appId","date","collection","genreId")
);

-- CreateIndex
CREATE INDEX "CategoryRank_appId_date_idx" ON "CategoryRank"("appId", "date");

-- AddForeignKey
ALTER TABLE "CategoryRank" ADD CONSTRAINT "CategoryRank_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
