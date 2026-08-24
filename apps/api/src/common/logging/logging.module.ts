import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '../../config/env';
import { WorkspaceContext } from '../tenancy/workspace-context';
import { loggerParams } from './logger-options';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService, WorkspaceContext],
      useFactory: (
        config: ConfigService<Env, true>,
        workspace: WorkspaceContext,
      ) => loggerParams(config, workspace),
    }),
  ],
})
export class LoggingModule {}
