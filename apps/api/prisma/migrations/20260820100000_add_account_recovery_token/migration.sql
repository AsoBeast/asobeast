-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_resetHash_key" ON "User"("resetHash");
