import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JOBS, QUEUES } from '../jobs/jobs.types';

@Injectable()
export class BillingEventQueue {
  constructor(@InjectQueue(QUEUES.BILLING) private readonly queue: Queue) {}

  async enqueue(eventId: string, attempt?: string): Promise<void> {
    const jobId = attempt
      ? `billing~${eventId}~${attempt}`
      : `billing~${eventId}`;
    await this.queue.add(JOBS.BILLING_EVENT, { eventId }, { jobId });
  }
}
