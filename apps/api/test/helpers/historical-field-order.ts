import { PrismaClient } from '@prisma/client';

export const restoreHistoricalFieldOrder = (prisma: PrismaClient) =>
  prisma.$executeRawUnsafe(
    'ALTER TABLE "TrackedKeyword" ADD COLUMN IF NOT EXISTS "fieldOrder" INTEGER',
  );

export const dropHistoricalFieldOrder = (prisma: PrismaClient) =>
  prisma.$executeRawUnsafe(
    'ALTER TABLE "TrackedKeyword" DROP COLUMN IF EXISTS "fieldOrder"',
  );
