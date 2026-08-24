import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { ChangesController } from './changes.controller';
import { ChangesService } from './changes.service';
import { RecentChangesController } from './recent-changes.controller';

@Module({
  imports: [AlertsModule],
  controllers: [ChangesController, RecentChangesController],
  providers: [ChangesService],
  exports: [ChangesService],
})
export class ChangesModule {}
