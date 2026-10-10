import { Logger } from '@nestjs/common';

export const OUTAGE_WARN_INTERVAL_MS = 30_000;

export const codeOf = (error: Error): string | undefined =>
  'code' in error && typeof error.code === 'string' ? error.code : undefined;

export const reasonOf = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  return error.message || codeOf(error) || error.name;
};

export class RedisOutageLog {
  private readonly logger = new Logger(RedisOutageLog.name);
  private lastWarnedAt = 0;

  report(error: unknown): void {
    const now = Date.now();
    if (now - this.lastWarnedAt < OUTAGE_WARN_INTERVAL_MS) return;
    this.lastWarnedAt = now;
    this.logger.warn(
      `redis is unreachable, so queued work waits and request path reads and rate limits fail fast: ${reasonOf(error)}`,
    );
  }
}
