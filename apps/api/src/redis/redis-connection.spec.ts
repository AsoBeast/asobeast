import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { redisConnection } from './redis-connection';

const config = (values: Partial<Env>) =>
  ({
    get: (key: keyof Env) => values[key],
  }) as unknown as ConfigService<Env, true>;

describe('redisConnection', () => {
  it('connects to the configured redis over resp2', () => {
    expect(
      redisConnection(
        config({ REDIS_HOST: 'redis', REDIS_PORT: 6380, REDIS_DB: 3 }),
      ),
    ).toEqual({ host: 'redis', port: 6380, db: 3, protocol: 2 });
  });
});
