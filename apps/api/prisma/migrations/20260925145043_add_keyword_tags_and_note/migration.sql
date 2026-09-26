-- AlterTable
ALTER TABLE "TrackedKeyword" ADD COLUMN     "note" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
