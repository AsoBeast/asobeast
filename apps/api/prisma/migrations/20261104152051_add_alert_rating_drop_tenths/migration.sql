-- AlterTable
ALTER TABLE "EmailAlert" ADD COLUMN     "ratingDropTenths" INTEGER;

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "ratingDropTenths" INTEGER;
