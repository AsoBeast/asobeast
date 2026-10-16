import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { AscApiFactory } from './asc-api.factory';
import { ASC_TRANSPORT, undiciTransport } from './asc-transport';
import { SECRET_BOX, secretBoxProvider } from './secret-box.provider';
import { StoreConnectionService } from './store-connection.service';
import { StoreConnectionsController } from './store-connections.controller';
import { StoreReportQueue } from './store-report-queue';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.STORE_CONNECT })],
  controllers: [StoreConnectionsController],
  providers: [
    secretBoxProvider,
    { provide: ASC_TRANSPORT, useValue: undiciTransport },
    AscApiFactory,
    StoreConnectionService,
    StoreReportQueue,
  ],
  exports: [StoreConnectionService, StoreReportQueue, SECRET_BOX],
})
export class StoreConnectModule {}
