import { Injectable, Logger } from '@nestjs/common';
import type { Store } from '@asobeast/shared';
import { AscReportSync } from './asc-report-sync.service';
import { PlayReportSync } from './play/play-report-sync.service';
import type { SyncSummary } from './store-sync-summary';

@Injectable()
export class StoreReportSyncService {
  private readonly logger = new Logger(StoreReportSyncService.name);

  constructor(
    private readonly appStore: AscReportSync,
    private readonly play: PlayReportSync,
  ) {}

  async run(store: Store): Promise<SyncSummary | null> {
    const summary =
      store === 'APP_STORE' ? await this.appStore.run() : await this.play.run();
    if (summary) {
      this.logger.log(`store report sync ${store} ${JSON.stringify(summary)}`);
    }
    return summary;
  }
}
