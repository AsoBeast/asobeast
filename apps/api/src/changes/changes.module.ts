import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { StoreConnectModule } from '../store-connect/store-connect.module';
import { ChangeImpactService } from './change-impact.service';
import { ChangesController } from './changes.controller';
import { ChangesService } from './changes.service';
import { RecentChangesController } from './recent-changes.controller';

@Module({
  imports: [AlertsModule, StoreConnectModule],
  controllers: [ChangesController, RecentChangesController],
  providers: [ChangesService, ChangeImpactService],
  exports: [ChangesService],
})
export class ChangesModule {}
