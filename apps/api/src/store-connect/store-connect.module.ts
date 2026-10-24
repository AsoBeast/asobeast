import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { AscApiFactory } from './asc-api.factory';
import { ASC_TRANSPORT, undiciTransport } from './asc-transport';
import { SECRET_BOX, secretBoxProvider } from './secret-box.provider';
import { StoreConnectionService } from './store-connection.service';
import { StoreConnectionsController } from './store-connections.controller';
import { StoreFunnelController } from './store-funnel.controller';
import { StoreFunnelService } from './store-funnel.service';
import { StoreReportApplier } from './store-report-applier';
import { StoreReportQueue } from './store-report-queue';
import { StoreReportRequester } from './store-report-requester';
import { StoreReportSyncService } from './store-report-sync.service';
import { StoreReportsWorker } from './store-reports.worker';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.STORE_CONNECT })],
  controllers: [StoreConnectionsController, StoreFunnelController],
  providers: [
    secretBoxProvider,
    { provide: ASC_TRANSPORT, useValue: undiciTransport },
    AscApiFactory,
    StoreConnectionService,
    StoreReportQueue,
    StoreReportRequester,
    StoreReportApplier,
    StoreReportSyncService,
    StoreReportsWorker,
    StoreFunnelService,
  ],
  exports: [
    StoreConnectionService,
    StoreReportQueue,
    StoreReportSyncService,
    SECRET_BOX,
  ],
})
export class StoreConnectModule {}
