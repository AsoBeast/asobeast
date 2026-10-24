-- AlterTable
ALTER TABLE "ReviewReply" ADD COLUMN     "postState" TEXT,
ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "postedByUserId" TEXT,
ADD COLUMN     "postedText" TEXT,
ADD COLUMN     "storeResponseId" TEXT,
ADD COLUMN     "storeReviewId" TEXT;

-- AlterTable
ALTER TABLE "StoreConnection" ADD COLUMN     "replyAccess" TEXT NOT NULL DEFAULT 'unknown';

-- CreateIndex
CREATE INDEX "ReviewReply_appId_postedAt_idx" ON "ReviewReply"("appId", "postedAt");

-- AddForeignKey
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
