UPDATE "KeywordRanking" AS r
SET "workspaceId" = a."workspaceId"
FROM "App" AS a
WHERE a."id" = r."appId" AND a."workspaceId" <> r."workspaceId";

UPDATE "ActionItem" AS i
SET "workspaceId" = a."workspaceId"
FROM "App" AS a
WHERE a."id" = i."appId" AND a."workspaceId" <> i."workspaceId";

UPDATE "App" AS c
SET "primaryAppId" = NULL
FROM "App" AS p
WHERE p."id" = c."primaryAppId" AND p."workspaceId" <> c."workspaceId";

UPDATE "App" AS a
SET "groupId" = NULL
FROM "AppGroup" AS g
WHERE g."id" = a."groupId" AND g."workspaceId" <> a."workspaceId";

-- DropForeignKey
ALTER TABLE "ActionItem" DROP CONSTRAINT "ActionItem_appId_fkey";

-- DropForeignKey
ALTER TABLE "App" DROP CONSTRAINT "App_groupId_fkey";

-- DropForeignKey
ALTER TABLE "App" DROP CONSTRAINT "App_primaryAppId_fkey";

-- DropForeignKey
ALTER TABLE "KeywordRanking" DROP CONSTRAINT "KeywordRanking_appId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "App_id_workspaceId_key" ON "App"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AppGroup_id_workspaceId_key" ON "AppGroup"("id", "workspaceId");

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_primaryAppId_workspaceId_fkey" FOREIGN KEY ("primaryAppId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_groupId_workspaceId_fkey" FOREIGN KEY ("groupId", "workspaceId") REFERENCES "AppGroup"("id", "workspaceId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordRanking" ADD CONSTRAINT "KeywordRanking_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_appId_workspaceId_fkey" FOREIGN KEY ("appId", "workspaceId") REFERENCES "App"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
