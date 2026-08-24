-- CreateTable
CREATE TABLE "SuggestProbe" (
    "appId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "probe" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestProbe_pkey" PRIMARY KEY ("appId","term","day","probe")
);

-- AddForeignKey
ALTER TABLE "SuggestProbe" ADD CONSTRAINT "SuggestProbe_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
