import { Processor } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { ErrorTracking } from '../observability/error-tracking.service';
import { PoolCapacity } from '../store-providers/egress/pool-capacity.service';
import { QUEUES } from './jobs.types';
import { StoreJobsHandler } from './store-jobs.handler';
import { StoreQueueWorker } from './store-queue.worker';
import {
  poolEnabledFromEnv,
  positiveEnv,
  storeWorkerOptions,
} from './store-worker-options';

@Processor(
  QUEUES.GPLAY,
  storeWorkerOptions({
    poolEnabled: poolEnabledFromEnv(),
    rpm: positiveEnv(process.env.SCRAPE_GPLAY_RPM, 10),
    maxConcurrency: positiveEnv(process.env.PROXY_WORKER_MAX_CONCURRENCY, 8),
  }),
)
export class GplayWorker extends StoreQueueWorker {
  constructor(
    handler: StoreJobsHandler,
    capacity: PoolCapacity,
    tracking: ErrorTracking,
  ) {
    super(
      new Logger(GplayWorker.name),
      Store.GOOGLE_PLAY,
      handler,
      capacity,
      tracking,
    );
  }
}
