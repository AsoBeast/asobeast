import { OnWorkerEvent, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Store } from '@prisma/client';
import { Job } from 'bullmq';
import { ErrorTracking } from '../observability/error-tracking.service';
import { PoolCapacity } from '../store-providers/egress/pool-capacity.service';
import { reportJobFailure } from './job-failure';
import { StoreJobsHandler } from './store-jobs.handler';
import { withoutRetry } from './unrecoverable';

export abstract class StoreQueueWorker
  extends WorkerHost
  implements OnModuleInit
{
  protected constructor(
    protected readonly logger: Logger,
    private readonly store: Store,
    private readonly handler: StoreJobsHandler,
    private readonly capacity: PoolCapacity,
    private readonly tracking: ErrorTracking,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.matchPoolCapacity();
  }

  async process(job: Job): Promise<void> {
    const startedAt = Date.now();
    this.logger.debug(`start ${job.name} #${job.id}`);
    await this.matchPoolCapacity();
    try {
      await this.handler.handle(job);
      this.logger.debug(
        `done ${job.name} #${job.id} in ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      this.logger.warn(
        `failed ${job.name} #${job.id}: ${(error as Error).message}`,
      );
      throw withoutRetry(error);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(this.tracking, job, error, { store: this.store });
  }

  private async matchPoolCapacity(): Promise<void> {
    const target = await this.capacity.concurrencyFor(this.store);
    if (target === null || this.worker.concurrency === target) return;
    this.logger.log(
      `concurrency ${this.worker.concurrency} to ${target} on healthy pool size`,
    );
    this.worker.concurrency = target;
  }
}
