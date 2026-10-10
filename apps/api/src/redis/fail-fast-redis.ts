import { type OnApplicationShutdown } from '@nestjs/common';
import { Redis, ReplyError, type RedisOptions } from 'ioredis';
import { RedisOutageLog } from './redis-outage-log';
import { RedisUnavailableError } from './redis.errors';

export const FAIL_FAST_COMMAND_TIMEOUT_MS = 500;
export const FAIL_FAST_CONNECT_TIMEOUT_MS = 1_000;
export const FAIL_FAST_RETRY_AFTER_SECONDS = 5;
export const FAIL_FAST_MAX_RECONNECT_DELAY_MS = 2_000;

const RECONNECT_STEP_MS = 50;

export class FailFastRedis implements OnApplicationShutdown {
  constructor(
    readonly client: Redis,
    private readonly outage = new RedisOutageLog(),
  ) {}

  static connect(
    connection: RedisOptions,
    outage = new RedisOutageLog(),
  ): FailFastRedis {
    const redis = new FailFastRedis(
      new Redis({
        ...connection,
        enableOfflineQueue: false,
        autoResendUnfulfilledCommands: false,
        commandTimeout: FAIL_FAST_COMMAND_TIMEOUT_MS,
        connectTimeout: FAIL_FAST_CONNECT_TIMEOUT_MS,
        retryStrategy: (attempt) =>
          Math.min(
            attempt * RECONNECT_STEP_MS,
            FAIL_FAST_MAX_RECONNECT_DELAY_MS,
          ),
      }),
      outage,
    );
    redis.client.on('error', (error: Error) => outage.report(error));
    return redis;
  }

  async run<T>(work: (client: Redis) => Promise<T>): Promise<T> {
    try {
      return await work(this.client);
    } catch (error) {
      if (error instanceof ReplyError) throw error;
      this.outage.report(error);
      throw new RedisUnavailableError(FAIL_FAST_RETRY_AFTER_SECONDS);
    }
  }

  async runOpen<T>(
    work: (client: Redis) => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await this.run(work);
    } catch (error) {
      if (error instanceof RedisUnavailableError) return fallback;
      throw error;
    }
  }

  onApplicationShutdown(): void {
    this.client.disconnect();
  }
}
