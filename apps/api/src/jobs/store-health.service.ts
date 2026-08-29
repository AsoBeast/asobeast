import {
  STORES,
  type Store,
  type StoreHealth,
  type StoreHealthReport,
} from '@asobeast/shared';
import { Injectable, Logger } from '@nestjs/common';
import type { PublishedStoreStatus } from '../store-providers/canary/published-status';
import { PublishedStatusService } from '../store-providers/canary/published-status.service';
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

  constructor(
    private readonly canary: StoreCanaryService,
    private readonly publishedStatus: PublishedStatusService,
  ) {}

  async report(): Promise<StoreHealthReport> {
    const [verdicts, published] = await Promise.all([
      this.degradable('the canary verdicts', () => this.canary.records()),
      this.degradable('the published store status', () =>
        this.publishedStatus.published(),
      ),
    ]);

    const stores = STORES.map((store) =>
      merge(healthOf(store, verdicts[store]), published[store]),
    );
    return {
      stores,
      degraded: stores.some((store) => store.state === 'broken'),
    };
  }

  private async degradable<T>(
    source: string,
    read: () => Promise<Partial<Record<Store, T>>>,
  ): Promise<Partial<Record<Store, T>>> {
    try {
      return await read();
    } catch (error) {
      this.logger.warn(
        `${source} could not be read, so this report leaves them out: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {};
    }
  }
}

function merge(
  canary: StoreHealth,
  published: PublishedStoreStatus | undefined,
): StoreHealth {
  if (published?.state !== 'broken') return canary;

  return {
    ...canary,
    state: 'broken',
    source: 'published',
    since: published.since ?? canary.since,
    detail: published.summary,
  };
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
