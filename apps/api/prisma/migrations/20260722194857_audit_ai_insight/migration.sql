/*
  Warnings:

  - You are about to drop the `AuditInput` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuditInput" DROP CONSTRAINT "AuditInput_appId_fkey";

-- DropTable
DROP TABLE "AuditInput";

-- CreateTable
CREATE TABLE "AuditInsight" (
    "appId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditInsight_pkey" PRIMARY KEY ("appId")
);

-- AddForeignKey
ALTER TABLE "AuditInsight" ADD CONSTRAINT "AuditInsight_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
