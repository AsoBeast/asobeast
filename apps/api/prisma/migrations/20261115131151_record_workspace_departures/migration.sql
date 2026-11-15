-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "deletionPlan" TEXT,
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "deletionStage" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceDeparture" (
    "id" TEXT NOT NULL,
    "erasedOn" DATE NOT NULL,
    "createdOn" DATE NOT NULL,
    "requestedOn" DATE NOT NULL,
    "stage" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "everPaid" BOOLEAN NOT NULL,
    "apps" INTEGER NOT NULL,
    "keywordMarkets" INTEGER NOT NULL,
    "members" INTEGER NOT NULL,
    "reason" TEXT,

    CONSTRAINT "WorkspaceDeparture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceDeparture_erasedOn_idx" ON "WorkspaceDeparture"("erasedOn");

GRANT SELECT, INSERT, UPDATE, DELETE ON "WorkspaceDeparture" TO asobeast_app;

ALTER TABLE "WorkspaceDeparture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceDeparture" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "WorkspaceDeparture"
  USING (app_tenancy_bypassed());
