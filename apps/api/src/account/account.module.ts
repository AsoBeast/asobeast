import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';
import { AccountExportService } from './account-export.service';

@Module({
  controllers: [AccountController],
  providers: [AccountExportService, AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountModule {}
