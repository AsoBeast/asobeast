-- DropIndex
DROP INDEX "AppSnapshot_appId_capturedAt_idx";

-- DropIndex
DROP INDEX "ChangeEvent_appId_capturedAt_idx";

-- AlterTable
ALTER TABLE "AppSnapshot" ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "ChangeEvent" ADD COLUMN     "country" TEXT;

-- CreateIndex
CREATE INDEX "AppSnapshot_appId_country_capturedAt_idx" ON "AppSnapshot"("appId", "country", "capturedAt");

-- CreateIndex
CREATE INDEX "ChangeEvent_appId_country_capturedAt_idx" ON "ChangeEvent"("appId", "country", "capturedAt");
