-- CreateTable
CREATE TABLE "EmailAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "webhookId" TEXT,
    "emailAlertId" TEXT,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "attempt" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailAlert_workspaceId_idx" ON "EmailAlert"("workspaceId");

-- CreateIndex
CREATE INDEX "AlertDelivery_webhookId_createdAt_idx" ON "AlertDelivery"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertDelivery_emailAlertId_createdAt_idx" ON "AlertDelivery"("emailAlertId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertDelivery_createdAt_idx" ON "AlertDelivery"("createdAt");

-- AddForeignKey
ALTER TABLE "EmailAlert" ADD CONSTRAINT "EmailAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_emailAlertId_fkey" FOREIGN KEY ("emailAlertId") REFERENCES "EmailAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
