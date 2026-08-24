-- CreateEnum
CREATE TYPE "Store" AS ENUM ('GOOGLE_PLAY', 'APP_STORE');

-- CreateEnum
CREATE TYPE "KeywordSource" AS ENUM ('TITLE', 'SUBTITLE', 'DESCRIPTION', 'KEYWORD_FIELD', 'SUGGESTED', 'MANUAL', 'COMPETITOR');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "storeAppId" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'us',
    "name" TEXT,
    "iconUrl" TEXT,
    "isCompetitor" BOOLEAN NOT NULL DEFAULT false,
    "primaryAppId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSnapshot" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT,
    "description" TEXT NOT NULL,
    "ratingAvg" DOUBLE PRECISION,
    "ratingCount" INTEGER,
    "installs" BIGINT,
    "price" DOUBLE PRECISION,
    "version" TEXT,
    "releasedAt" TIMESTAMP(3),
    "storeUpdatedAt" TIMESTAMP(3),
    "raw" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'us',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedKeyword" (
    "appId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "source" "KeywordSource" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedKeyword_pkey" PRIMARY KEY ("appId","keywordId")
);

-- CreateTable
CREATE TABLE "KeywordMetric" (
    "keywordId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "traffic" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordMetric_pkey" PRIMARY KEY ("keywordId","date")
);

-- CreateTable
CREATE TABLE "KeywordRanking" (
    "appId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "position" INTEGER,
    "depth" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordRanking_pkey" PRIMARY KEY ("appId","keywordId","date")
);

-- CreateIndex
CREATE INDEX "App_workspaceId_idx" ON "App"("workspaceId");

-- CreateIndex
CREATE INDEX "App_primaryAppId_idx" ON "App"("primaryAppId");

-- CreateIndex
CREATE UNIQUE INDEX "App_workspaceId_store_storeAppId_country_key" ON "App"("workspaceId", "store", "storeAppId", "country");

-- CreateIndex
CREATE INDEX "AppSnapshot_appId_capturedAt_idx" ON "AppSnapshot"("appId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_text_store_country_key" ON "Keyword"("text", "store", "country");

-- CreateIndex
CREATE INDEX "TrackedKeyword_keywordId_idx" ON "TrackedKeyword"("keywordId");

-- CreateIndex
CREATE INDEX "KeywordRanking_keywordId_date_idx" ON "KeywordRanking"("keywordId", "date");

-- CreateIndex
CREATE INDEX "KeywordRanking_appId_date_idx" ON "KeywordRanking"("appId", "date");

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_primaryAppId_fkey" FOREIGN KEY ("primaryAppId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSnapshot" ADD CONSTRAINT "AppSnapshot_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedKeyword" ADD CONSTRAINT "TrackedKeyword_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedKeyword" ADD CONSTRAINT "TrackedKeyword_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordMetric" ADD CONSTRAINT "KeywordMetric_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordRanking" ADD CONSTRAINT "KeywordRanking_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordRanking" ADD CONSTRAINT "KeywordRanking_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
