import { WorkerHost } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Queue, QueueBase, Worker } from 'bullmq';
import { reasonOf, RedisOutageLog } from '../redis/redis-outage-log';

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
  const { code } = error as NodeJS.ErrnoException;
  return (
    (code !== undefined && UNREACHABLE_CODES.has(code)) ||
    error.message === CONNECTION_CLOSED ||
    error.name === RETRIES_EXHAUSTED
  );
}

function createdWorker(host: WorkerHost<Worker>): Worker[] {
  try {
    return [host.worker];
  } catch {
    return [];
  }
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
      emitter.on('error', (error: Error) => this.report(error));
    }
  }

  private emitters(): Set<QueueBase> {
    const instances = this.discovery
      .getProviders()
      .map((wrapper): unknown => wrapper.instance);
    const queues = instances.filter(
      (instance): instance is Queue => instance instanceof Queue,
    );
    const workers = instances
      .filter(
        (instance): instance is WorkerHost<Worker> =>
          instance instanceof WorkerHost,
      )
      .flatMap(createdWorker);
    return new Set<QueueBase>([...queues, ...workers]);
  }

  private report(error: Error): void {
    if (isRedisUnreachable(error)) {
      this.outage.report(error);
      return;
    }
    this.logger.error(reasonOf(error), error.stack);
  }
}
