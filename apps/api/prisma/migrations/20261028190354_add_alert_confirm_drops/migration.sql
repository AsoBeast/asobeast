-- AlterTable
ALTER TABLE "EmailAlert" ADD COLUMN     "confirmDrops" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "confirmDrops" BOOLEAN NOT NULL DEFAULT false;
