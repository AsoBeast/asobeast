-- DropIndex
DROP INDEX "AppSnapshot_appId_country_capturedAt_idx";

-- DropIndex
DROP INDEX "ChangeEvent_appId_country_capturedAt_idx";

-- AlterTable
ALTER TABLE "AppSnapshot" ADD COLUMN     "localization" TEXT;

-- AlterTable
ALTER TABLE "ChangeEvent" ADD COLUMN     "localization" TEXT;

-- CreateIndex
CREATE INDEX "AppSnapshot_appId_country_localization_capturedAt_idx" ON "AppSnapshot"("appId", "country", "localization", "capturedAt");

-- CreateIndex
CREATE INDEX "ChangeEvent_appId_country_localization_capturedAt_idx" ON "ChangeEvent"("appId", "country", "localization", "capturedAt");
