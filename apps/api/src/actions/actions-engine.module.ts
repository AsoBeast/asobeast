import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { MetadataModule } from '../metadata/metadata.module';
import { ActionContextLoader } from './action-context';
import { ActionsGenerator } from './actions.generator';
import { ActionsNotifier } from './actions.notifier';

@Module({
  imports: [AlertsModule, KeywordsModule, MetadataModule],
  providers: [ActionContextLoader, ActionsGenerator, ActionsNotifier],
  exports: [ActionsGenerator, ActionsNotifier],
})
export class ActionsEngineModule {}
