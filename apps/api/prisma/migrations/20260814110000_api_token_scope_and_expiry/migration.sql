-- AlterTable
ALTER TABLE "ApiToken" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'read',
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "ApiToken" SET "scope" = 'write';
