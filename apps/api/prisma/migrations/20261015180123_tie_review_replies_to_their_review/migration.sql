-- DropForeignKey
ALTER TABLE "ReviewReply" DROP CONSTRAINT "ReviewReply_reviewId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Review_id_appId_key" ON "Review"("id", "appId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReply_reviewId_appId_key" ON "ReviewReply"("reviewId", "appId");

-- AddForeignKey
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_reviewId_appId_fkey" FOREIGN KEY ("reviewId", "appId") REFERENCES "Review"("id", "appId") ON DELETE CASCADE ON UPDATE CASCADE;

