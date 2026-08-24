-- CreateTable
CREATE TABLE "ProxySpend" (
    "month" TEXT NOT NULL,
    "tier" "ProxyTier" NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProxySpend_pkey" PRIMARY KEY ("month","tier")
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "ProxySpend" TO asobeast_app;

ALTER TABLE "ProxySpend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProxySpend" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "ProxySpend"
  USING (app_tenancy_bypassed());
