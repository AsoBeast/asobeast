import { Redis } from 'ioredis';

function testRedisDb(): number {
  const db = Number(process.env.REDIS_DB);
  if (!Number.isInteger(db) || db <= 0) {
    throw new Error(
      `These specs flush their Redis database, so REDIS_DB must name one other than 0, got ${process.env.REDIS_DB ?? 'none'}.`,
    );
  }
  return db;
}

beforeAll(async () => {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    db: testRedisDb(),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.connect();
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
});
