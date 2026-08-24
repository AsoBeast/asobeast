-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "overLimitNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "overLimitSince" TIMESTAMP(3);
