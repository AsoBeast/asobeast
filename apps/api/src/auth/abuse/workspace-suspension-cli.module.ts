import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenancyCoreModule } from '../../common/tenancy/tenancy-core.module';
import { validateEnv } from '../../config/env';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkspaceSuspension } from './workspace-suspension.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    TenancyCoreModule,
    PrismaModule,
  ],
  providers: [WorkspaceSuspension],
})
export class WorkspaceSuspensionCliModule {}
