import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { MetadataModule } from '../metadata/metadata.module';
import { ActionContextLoader } from './action-context';
import { ActionEventRecorder } from './action-events';
import { ActionsGenerator } from './actions.generator';
import { ActionsNotifier } from './actions.notifier';

@Module({
  imports: [AlertsModule, KeywordsModule, MetadataModule],
  providers: [
    ActionContextLoader,
    ActionEventRecorder,
    ActionsGenerator,
    ActionsNotifier,
  ],
  exports: [ActionEventRecorder, ActionsGenerator, ActionsNotifier],
})
export class ActionsEngineModule {}
