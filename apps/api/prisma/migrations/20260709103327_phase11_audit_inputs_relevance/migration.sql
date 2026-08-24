-- AlterTable
ALTER TABLE "TrackedKeyword" ADD COLUMN     "relevance" INTEGER;

-- CreateTable
CREATE TABLE "AuditInput" (
    "appId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditInput_pkey" PRIMARY KEY ("appId")
);

-- AddForeignKey
ALTER TABLE "AuditInput" ADD CONSTRAINT "AuditInput_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
