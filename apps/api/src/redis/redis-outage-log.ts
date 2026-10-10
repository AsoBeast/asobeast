import { Logger } from '@nestjs/common';

export const OUTAGE_WARN_INTERVAL_MS = 30_000;

export class RedisOutageLog {
  private readonly logger = new Logger(RedisOutageLog.name);
  private lastWarnedAt = 0;

  report(error: unknown): void {
    const now = Date.now();
    if (now - this.lastWarnedAt < OUTAGE_WARN_INTERVAL_MS) return;
    this.lastWarnedAt = now;
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `redis is unreachable, so request path reads and rate limits fail fast: ${reason}`,
    );
  }
}
