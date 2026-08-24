-- AlterTable
ALTER TABLE "ProxyHealth" ADD COLUMN "pacedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ProxyHealth_store_pacedUntil_idx" ON "ProxyHealth"("store", "pacedUntil");
