import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AccountController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';
import { AccountExportService } from './account-export.service';

@Module({
  imports: [BillingModule],
  controllers: [AccountController],
  providers: [AccountExportService, AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountModule {}
