-- AlterTable
ALTER TABLE "SupportAccess" ADD COLUMN     "detail" TEXT,
ADD COLUMN     "outcome" TEXT NOT NULL DEFAULT 'attempted';
