-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "billingCustomerId" TEXT,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionId" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_billingCustomerId_key" ON "Workspace"("billingCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_subscriptionId_key" ON "Workspace"("subscriptionId");

UPDATE "Workspace" w
SET "plan" = o."plan",
    "trialEndsAt" = o."trialEndsAt",
    "planExpiresAt" = o."planExpiresAt",
    "billingCustomerId" = o."billingCustomerId"
FROM (
  SELECT DISTINCT ON ("workspaceId")
         "workspaceId", "plan", "trialEndsAt", "planExpiresAt", "billingCustomerId"
  FROM "User"
  ORDER BY "workspaceId", ("role" = 'owner') DESC, "createdAt" ASC
) o
WHERE o."workspaceId" = w."id";
