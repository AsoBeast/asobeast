import { testDb } from './test-db';

const RESET_TRACKED_DATA = `
DO $$
BEGIN
  IF to_regclass('public."App"') IS NOT NULL THEN
    TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE;
  END IF;
END
$$`;

beforeAll(async () => {
  const prisma = testDb();
  try {
    await prisma.$executeRawUnsafe(RESET_TRACKED_DATA);
  } finally {
    await prisma.$disconnect();
  }
});
