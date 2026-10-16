import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { AscApiFactory } from './asc-api.factory';
import { AscReportSync } from './asc-report-sync.service';
import { ASC_TRANSPORT, undiciTransport } from './asc-transport';
import { GcsApiFactory } from './play/gcs-api.factory';
import { PlayReportSync } from './play/play-report-sync.service';
import { GCS_TRANSPORT, undiciGcsTransport } from './play/gcs-transport';
import { SECRET_BOX, secretBoxProvider } from './secret-box.provider';
import { StoreConnectionService } from './store-connection.service';
import { StoreConnectionsController } from './store-connections.controller';
import { AppStoreKeys, PlayKeys } from './store-keys';
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
    { provide: GCS_TRANSPORT, useValue: undiciGcsTransport },
    GcsApiFactory,
    AppStoreKeys,
    PlayKeys,
    StoreConnectionService,
    StoreReportQueue,
    StoreReportRequester,
    StoreReportApplier,
    AscReportSync,
    PlayReportSync,
    StoreReportSyncService,
    StoreReportsWorker,
    StoreFunnelService,
  ],
  exports: [
    StoreConnectionService,
    StoreReportQueue,
    StoreReportSyncService,
    StoreFunnelService,
    SECRET_BOX,
  ],
})
export class StoreConnectModule {}
