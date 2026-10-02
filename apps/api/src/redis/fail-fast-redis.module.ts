import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { FailFastRedis } from './fail-fast-redis';
import { redisConnection } from './redis-connection';

@Global()
@Module({
  providers: [
    {
      provide: FailFastRedis,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        FailFastRedis.connect(redisConnection(config)),
    },
  ],
  exports: [FailFastRedis],
})
export class FailFastRedisModule {}
