-- CreateTable
CREATE TABLE "AuditScore" (
    "appId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "overall" DOUBLE PRECISION,
    "coveredWeight" INTEGER NOT NULL,
    "totalWeight" INTEGER NOT NULL,
    "factors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditScore_pkey" PRIMARY KEY ("appId","date")
);

-- CreateIndex
CREATE INDEX "AuditScore_appId_date_idx" ON "AuditScore"("appId", "date");

-- AddForeignKey
ALTER TABLE "AuditScore" ADD CONSTRAINT "AuditScore_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
