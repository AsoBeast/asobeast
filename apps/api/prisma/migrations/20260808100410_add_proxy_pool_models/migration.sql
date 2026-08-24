-- CreateEnum
CREATE TYPE "ProxyProtocol" AS ENUM ('HTTP', 'SOCKS5');

-- CreateEnum
CREATE TYPE "ProxyTier" AS ENUM ('DATACENTER', 'RESIDENTIAL');

-- CreateEnum
CREATE TYPE "ProxyOutcome" AS ENUM ('SUCCESS', 'TRANSPORT', 'RATE_LIMITED', 'BLOCKED', 'SILENT');

-- CreateTable
CREATE TABLE "ProxyEndpoint" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" "ProxyProtocol" NOT NULL DEFAULT 'HTTP',
    "tier" "ProxyTier" NOT NULL DEFAULT 'DATACENTER',
    "credentialRef" TEXT NOT NULL,
    "country" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProxyEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProxyHealth" (
    "endpointId" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "successes" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cooldownUntil" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastOutcome" "ProxyOutcome",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProxyHealth_pkey" PRIMARY KEY ("endpointId","store")
);

-- CreateIndex
CREATE INDEX "ProxyEndpoint_enabled_tier_idx" ON "ProxyEndpoint"("enabled", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "ProxyEndpoint_provider_externalId_key" ON "ProxyEndpoint"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProxyEndpoint_host_port_key" ON "ProxyEndpoint"("host", "port");

-- CreateIndex
CREATE INDEX "ProxyHealth_store_cooldownUntil_idx" ON "ProxyHealth"("store", "cooldownUntil");

-- CreateIndex
CREATE INDEX "ProxyHealth_store_lastUsedAt_idx" ON "ProxyHealth"("store", "lastUsedAt");

-- AddForeignKey
ALTER TABLE "ProxyHealth" ADD CONSTRAINT "ProxyHealth_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ProxyEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "ProxyEndpoint" TO asobeast_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ProxyHealth" TO asobeast_app;

ALTER TABLE "ProxyEndpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProxyEndpoint" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "ProxyEndpoint"
  USING (app_tenancy_bypassed());

ALTER TABLE "ProxyHealth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProxyHealth" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "ProxyHealth"
  USING (app_tenancy_bypassed());
