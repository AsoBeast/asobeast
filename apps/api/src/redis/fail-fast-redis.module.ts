import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { FailFastRedis } from './fail-fast-redis';
import { RedisOutageLog } from './redis-outage-log';
import { redisConnection } from './redis-connection';

@Global()
@Module({
  providers: [
    RedisOutageLog,
    {
      provide: FailFastRedis,
      inject: [ConfigService, RedisOutageLog],
      useFactory: (config: ConfigService<Env, true>, outage: RedisOutageLog) =>
        FailFastRedis.connect(redisConnection(config), outage),
    },
  ],
  exports: [FailFastRedis, RedisOutageLog],
})
export class FailFastRedisModule {}
