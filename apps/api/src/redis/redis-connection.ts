import type { RedisOptions } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

const RESP2 = 2;

export function redisConnection(
  config: ConfigService<Env, true>,
): RedisOptions {
  const host: string = config.get('REDIS_HOST', { infer: true });
  const port: number = config.get('REDIS_PORT', { infer: true });
  const db: number = config.get('REDIS_DB', { infer: true });
  return { host, port, db, protocol: RESP2 };
}
