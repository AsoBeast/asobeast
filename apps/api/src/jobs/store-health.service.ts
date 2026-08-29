import {
  STORES,
  type Store,
  type StoreHealth,
  type StoreHealthReport,
} from '@asobeast/shared';
import { Injectable, Logger } from '@nestjs/common';
import {
  CANARY_CONFIRMATIONS,
  StoreCanaryRecord,
  StoreCanaryService,
} from '../store-providers/canary/store-canary.service';

const UNKNOWN: Pick<StoreHealth, 'state' | 'source' | 'since' | 'checkedAt'> = {
  state: 'unknown',
  source: 'canary',
  since: null,
  checkedAt: null,
};

@Injectable()
export class StoreHealthService {
  private readonly logger = new Logger(StoreHealthService.name);

  constructor(private readonly canary: StoreCanaryService) {}

  async report(): Promise<StoreHealthReport> {
    const verdicts = await this.verdicts();
    const stores = STORES.map((store) => healthOf(store, verdicts[store]));
    return {
      stores,
      degraded: stores.some((store) => store.state === 'broken'),
    };
  }

  private async verdicts(): Promise<Partial<Record<Store, StoreCanaryRecord>>> {
    try {
      return await this.canary.records();
    } catch (error) {
      this.logger.warn(
        `the canary verdicts could not be read, so every store reports unknown: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {};
    }
  }
}

function healthOf(
  store: Store,
  record: StoreCanaryRecord | undefined,
): StoreHealth {
  if (!record) return { store, ...UNKNOWN, detail: null };

  const base = {
    store,
    source: 'canary' as const,
    checkedAt: record.checkedAt,
  };
  if (record.outcome === 'broken') {
    return record.consecutiveFailures >= CANARY_CONFIRMATIONS
      ? {
          ...base,
          state: 'broken',
          since: record.failingSince,
          detail: record.detail,
        }
      : { ...base, state: 'ok', since: null, detail: null };
  }
  if (record.outcome === 'unreachable') {
    return {
      ...base,
      state: 'unreachable',
      since: null,
      detail: record.detail,
    };
  }
  if (record.outcome === 'ok') {
    return { ...base, state: 'ok', since: null, detail: null };
  }
  return { ...base, state: 'unknown', since: null, detail: null };
}
