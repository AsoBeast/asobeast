import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { reconnectDelay } from './reconnect-delay';
import { redisConnection } from './redis-connection';

const config = (values: Partial<Env>) =>
  ({
    get: (key: keyof Env) => values[key],
  }) as unknown as ConfigService<Env, true>;

describe('redisConnection', () => {
  const connection = redisConnection(
    config({ REDIS_HOST: 'redis', REDIS_PORT: 6380, REDIS_DB: 3 }),
  );

  it('connects to the configured redis over resp2', () => {
    expect(connection).toEqual({
      host: 'redis',
      port: 6380,
      db: 3,
      protocol: 2,
      retryStrategy: reconnectDelay,
      maxRetriesPerRequest: null,
    });
  });

  it('reconnects within two seconds, as the fail fast client does', () => {
    expect(connection.retryStrategy?.(1)).toBe(50);
    expect(connection.retryStrategy?.(1_000)).toBe(2_000);
  });

  it('keeps a command waiting for redis instead of failing after a retry budget', () => {
    expect(connection.maxRetriesPerRequest).toBeNull();
  });
});
