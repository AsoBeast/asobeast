-- AlterTable
ALTER TABLE "AuditInsight" ADD COLUMN     "inputHash" TEXT,
ADD COLUMN     "observations" JSONB,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "runError" TEXT,
ADD COLUMN     "runState" TEXT NOT NULL DEFAULT 'completed',
ALTER COLUMN "checks" SET DEFAULT '{}',
ALTER COLUMN "generatedAt" DROP NOT NULL,
ALTER COLUMN "generatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditScore" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "rubricVersion" TEXT NOT NULL DEFAULT 'v1';
