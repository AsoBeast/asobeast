import { testDb } from './helpers/test-db';

const TRUNCATE_KEYWORDS = `
DO $$
BEGIN
  IF to_regclass('public."Keyword"') IS NOT NULL THEN
    TRUNCATE TABLE "Keyword" CASCADE;
  END IF;
END
$$`;

beforeAll(async () => {
  const prisma = testDb();
  try {
    await prisma.$executeRawUnsafe(TRUNCATE_KEYWORDS);
  } finally {
    await prisma.$disconnect();
  }
});
