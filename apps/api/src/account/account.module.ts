import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AccountController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';
import { AccountExportService } from './account-export.service';
import { WorkspaceDepartures } from './workspace-departures';

@Module({
  imports: [BillingModule],
  controllers: [AccountController],
  providers: [
    AccountExportService,
    AccountDeletionService,
    WorkspaceDepartures,
  ],
  exports: [AccountDeletionService],
})
export class AccountModule {}
