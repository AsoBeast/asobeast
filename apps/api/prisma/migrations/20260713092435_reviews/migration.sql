-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userName" TEXT,
    "score" INTEGER NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "version" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_appId_reviewedAt_idx" ON "Review"("appId", "reviewedAt");

-- CreateIndex
CREATE INDEX "Review_appId_score_idx" ON "Review"("appId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Review_appId_reviewId_key" ON "Review"("appId", "reviewId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
