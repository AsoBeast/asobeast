-- AlterTable
ALTER TABLE "KeywordMetric" ADD COLUMN     "capturedAt" TIMESTAMP(3),
ADD COLUMN     "confidence" TEXT,
ADD COLUMN     "formulaVersion" TEXT,
ADD COLUMN     "scoringSource" TEXT;
