-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "verificationHash" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationHash_key" ON "User"("verificationHash");
