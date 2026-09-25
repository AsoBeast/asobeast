import { testDb } from './test-db';

beforeAll(async () => {
  const prisma = testDb();
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  } finally {
    await prisma.$disconnect();
  }
});
