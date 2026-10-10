import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { QueueBase } from 'bullmq';
import { codeOf, reasonOf, RedisOutageLog } from '../redis/redis-outage-log';
import { discoveredQueues, discoveredWorkers } from './discovered-queues';

const UNREACHABLE_CODES = new Set([
  'EADDRNOTAVAIL',
  'EAI_AGAIN',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
]);
const CONNECTION_CLOSED = 'Connection is closed.';
const RETRIES_EXHAUSTED = 'MaxRetriesPerRequestError';

export function isRedisUnreachable(error: Error): boolean {
  const code = codeOf(error);
  return (
    (code !== undefined && UNREACHABLE_CODES.has(code)) ||
    error.message === CONNECTION_CLOSED ||
    error.name === RETRIES_EXHAUSTED
  );
}

export function reportQueueError(
  error: Error,
  outage: RedisOutageLog,
  logger: Logger,
): void {
  if (isRedisUnreachable(error)) {
    outage.report(error);
    return;
  }
  logger.error(reasonOf(error), error.stack);
}

@Injectable()
export class QueueErrorReporter implements OnApplicationBootstrap {
  private readonly logger = new Logger(QueueErrorReporter.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly outage: RedisOutageLog,
  ) {}

  onApplicationBootstrap(): void {
    for (const emitter of this.emitters()) {
      emitter.on('error', (error: Error) =>
        reportQueueError(error, this.outage, this.logger),
      );
    }
  }

  private emitters(): Set<QueueBase> {
    return new Set<QueueBase>([
      ...discoveredQueues(this.discovery),
      ...discoveredWorkers(this.discovery),
    ]);
  }
}
