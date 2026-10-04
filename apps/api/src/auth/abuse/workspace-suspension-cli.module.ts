import { Module } from '@nestjs/common';
import { TenancyCoreModule } from '../../common/tenancy/tenancy-core.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkspaceSuspension } from './workspace-suspension.service';
import { envConfigModule } from '../../config/env-config.module';

@Module({
  imports: [envConfigModule(), TenancyCoreModule, PrismaModule],
  providers: [WorkspaceSuspension],
})
export class WorkspaceSuspensionCliModule {}
