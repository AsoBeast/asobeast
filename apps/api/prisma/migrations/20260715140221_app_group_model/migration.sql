/*
  Warnings:

  - A unique constraint covering the columns `[groupId,store]` on the table `App` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "App" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "AppGroup" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppGroup_workspaceId_idx" ON "AppGroup"("workspaceId");

-- CreateIndex
CREATE INDEX "App_groupId_idx" ON "App"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "App_groupId_store_key" ON "App"("groupId", "store");

-- AddForeignKey
ALTER TABLE "AppGroup" ADD CONSTRAINT "AppGroup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AppGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
