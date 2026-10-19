import { type OnApplicationShutdown } from '@nestjs/common';
import { Redis, ReplyError, type RedisOptions } from 'ioredis';
import { RedisOutageLog } from './redis-outage-log';
import { RedisUnavailableError } from './redis.errors';
import { MAX_RECONNECT_DELAY_MS, reconnectDelay } from './reconnect-delay';

export const FAIL_FAST_COMMAND_TIMEOUT_MS = 500;
export const FAIL_FAST_CONNECT_TIMEOUT_MS = 1_000;
export const FAIL_FAST_RETRY_AFTER_SECONDS = 5;
export const FAIL_FAST_MAX_RECONNECT_DELAY_MS = MAX_RECONNECT_DELAY_MS;

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
        retryStrategy: reconnectDelay,
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
