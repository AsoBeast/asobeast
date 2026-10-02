import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Redis, ReplyError, type RedisOptions } from 'ioredis';
import { RedisUnavailableError } from './redis.errors';

export const FAIL_FAST_COMMAND_TIMEOUT_MS = 500;
export const FAIL_FAST_CONNECT_TIMEOUT_MS = 1_000;
export const FAIL_FAST_RETRY_AFTER_SECONDS = 5;

const WARN_INTERVAL_MS = 30_000;

export class FailFastRedis implements OnApplicationShutdown {
  private readonly logger = new Logger(FailFastRedis.name);
  private lastWarnedAt = 0;

  constructor(readonly client: Redis) {}

  static connect(connection: RedisOptions): FailFastRedis {
    const redis = new FailFastRedis(
      new Redis({
        ...connection,
        enableOfflineQueue: false,
        autoResendUnfulfilledCommands: false,
        commandTimeout: FAIL_FAST_COMMAND_TIMEOUT_MS,
        connectTimeout: FAIL_FAST_CONNECT_TIMEOUT_MS,
      }),
    );
    redis.client.on('error', (error: Error) => redis.warn(error));
    return redis;
  }

  async run<T>(work: (client: Redis) => Promise<T>): Promise<T> {
    try {
      return await work(this.client);
    } catch (error) {
      if (error instanceof ReplyError) throw error;
      this.warn(error);
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

  private warn(error: unknown): void {
    const now = Date.now();
    if (now - this.lastWarnedAt < WARN_INTERVAL_MS) return;
    this.lastWarnedAt = now;
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `redis is unreachable, so request path reads and rate limits fail fast: ${reason}`,
    );
  }
}
