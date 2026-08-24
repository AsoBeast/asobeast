import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { JobsModule } from '../jobs/jobs.module';
import { QUEUES } from '../jobs/jobs.types';
import { SupportAudit } from './support-audit.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.APP_STORE },
      { name: QUEUES.GPLAY },
    ),
    AuthModule,
    BillingModule,
    JobsModule,
  ],
  controllers: [SupportController],
  providers: [SupportService, SupportAudit],
})
export class SupportModule {}
