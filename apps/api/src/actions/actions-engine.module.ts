import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { MetadataModule } from '../metadata/metadata.module';
import { StoreConnectModule } from '../store-connect/store-connect.module';
import { ActionContextLoader } from './action-context';
import { ActionEventRecorder } from './action-events';
import { ActionFunnelReader } from './action-funnel';
import { ActionsGenerator } from './actions.generator';
import { ActionsNotifier } from './actions.notifier';

@Module({
  imports: [AlertsModule, KeywordsModule, MetadataModule, StoreConnectModule],
  providers: [
    ActionContextLoader,
    ActionFunnelReader,
    ActionEventRecorder,
    ActionsGenerator,
    ActionsNotifier,
  ],
  exports: [ActionEventRecorder, ActionsGenerator, ActionsNotifier],
})
export class ActionsEngineModule {}
