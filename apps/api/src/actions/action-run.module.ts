import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { ActionRunQueue } from './action-run.queue';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.PIPELINE })],
  providers: [ActionRunQueue],
  exports: [ActionRunQueue],
})
export class ActionRunModule {}
