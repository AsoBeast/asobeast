import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ActionRunModule } from './action-run.module';
import { ActionsEngineModule } from './actions-engine.module';
import { ActionsController, AppActionsController } from './actions.controller';
import { ActionsAiService } from './actions-ai.service';
import { ActionActivityService } from './action-activity.service';
import { ActionDetailService } from './action-detail.service';
import { ActionSeriesReader } from './action-series.reader';
import { ActionTransitions } from './action-transitions';
import { ActionsService } from './actions.service';

@Module({
  imports: [ActionRunModule, ActionsEngineModule, AiModule],
  controllers: [ActionsController, AppActionsController],
  providers: [
    ActionsService,
    ActionsAiService,
    ActionTransitions,
    ActionDetailService,
    ActionSeriesReader,
    ActionActivityService,
  ],
  exports: [ActionsService],
})
export class ActionsModule {}
