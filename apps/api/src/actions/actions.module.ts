import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { QUEUES } from '../jobs/jobs.types';
import { ActionRunModule } from './action-run.module';
import { ActionsEngineModule } from './actions-engine.module';
import { ActionsController, AppActionsController } from './actions.controller';
import { ActionsAiService } from './actions-ai.service';
import { ActionsService } from './actions.service';

@Module({
  imports: [
    ActionRunModule,
    ActionsEngineModule,
    AiModule,
    BullModule.registerQueue({ name: QUEUES.PIPELINE }),
  ],
  controllers: [ActionsController, AppActionsController],
  providers: [ActionsService, ActionsAiService],
  exports: [ActionsService],
})
export class ActionsModule {}
