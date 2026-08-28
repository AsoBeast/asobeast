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
  QUEUES.APP_STORE,
  storeWorkerOptions({
    poolEnabled: poolEnabledFromEnv(),
    rpm: positiveEnv(process.env.SCRAPE_ITUNES_RPM, 15),
    maxConcurrency: positiveEnv(process.env.PROXY_WORKER_MAX_CONCURRENCY, 8),
  }),
)
export class AppStoreWorker extends StoreQueueWorker {
  constructor(
    handler: StoreJobsHandler,
    capacity: PoolCapacity,
    tracking: ErrorTracking,
  ) {
    super(
      new Logger(AppStoreWorker.name),
      Store.APP_STORE,
      handler,
      capacity,
      tracking,
    );
  }
}
