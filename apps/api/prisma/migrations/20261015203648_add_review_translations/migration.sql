-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "sourceLanguage" TEXT,
ADD COLUMN     "translatedAt" TIMESTAMP(3),
ADD COLUMN     "translatedText" TEXT,
ADD COLUMN     "translatedTitle" TEXT,
ADD COLUMN     "translationLanguage" TEXT;
