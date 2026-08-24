import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { HealthController } from './health.controller';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.PIPELINE },
      { name: QUEUES.APP_STORE },
      { name: QUEUES.GPLAY },
      { name: QUEUES.ALERTS },
    ),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
