-- AlterTable
ALTER TABLE "EmailAlert" ADD COLUMN     "reviewScores" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "reviewScores" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
