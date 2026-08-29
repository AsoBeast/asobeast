import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CategoryRanksModule } from '../category-ranks/category-ranks.module';
import { QUEUES } from '../jobs/jobs.types';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { InstanceMetricsCollector } from './instance-metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { ResourceMetricsCollector } from './resource-metrics.service';
import { WorkspaceMetricsCollector } from './workspace-metrics.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.PIPELINE }),
    CategoryRanksModule,
    StoreProvidersModule,
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    WorkspaceMetricsCollector,
    InstanceMetricsCollector,
    ResourceMetricsCollector,
  ],
})
export class MetricsModule {}
