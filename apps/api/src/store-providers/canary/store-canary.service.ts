import { SUPPORTED_STORES } from '@asobeast/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { storeCanaryKey } from '../../jobs/jobs.types';
import { FailFastRedis } from '../../redis/fail-fast-redis';
import { ProxyEgress } from '../egress/proxy-egress.service';
import { StoreProviderRegistry } from '../store-provider.registry';
import { assertParsedApp, assertSearchResults } from './canary-checks';
import {
  CANARY_OUTCOMES,
  CanaryOutcome,
  outcomeOfError,
} from './canary-outcome';

export const CANARY_CONFIRMATIONS = 2;

export const CANARY_SEARCH_RESULTS = 5;

export interface CanaryTarget {
  storeAppId: string;
  term: string;
  country: string;
}

export const CANARY_TARGETS: Record<Store, CanaryTarget> = {
  APP_STORE: { storeAppId: '284882215', term: 'photo editor', country: 'us' },
  GOOGLE_PLAY: {
    storeAppId: 'com.facebook.katana',
    term: 'photo editor',
    country: 'us',
  },
};

export interface StoreCanaryRecord {
  outcome: CanaryOutcome;
  detail: string | null;
  checkedAt: string;
  failingSince: string | null;
  consecutiveFailures: number;
}

type CanaryVerdict = Pick<StoreCanaryRecord, 'outcome' | 'detail'>;

@Injectable()
export class StoreCanaryService {
  private readonly logger = new Logger(StoreCanaryService.name);

  constructor(
    private readonly registry: StoreProviderRegistry,
    private readonly egress: ProxyEgress,
    private readonly redis: FailFastRedis,
  ) {}

  async run(): Promise<Record<Store, StoreCanaryRecord>> {
    const records = {} as Record<Store, StoreCanaryRecord>;
    for (const store of SUPPORTED_STORES) {
      records[store] = await this.check(store);
    }
    return records;
  }

  async records(): Promise<Partial<Record<Store, StoreCanaryRecord>>> {
    const records: Partial<Record<Store, StoreCanaryRecord>> = {};
    for (const store of SUPPORTED_STORES) {
      const record = await this.read(store);
      if (record) records[store] = record;
    }
    return records;
  }

  private async check(store: Store): Promise<StoreCanaryRecord> {
    const previous = await this.read(store);
    const record = nextRecord(
      previous,
      await this.probe(store),
      new Date().toISOString(),
    );
    await this.redis.run((client) =>
      client.set(storeCanaryKey(store), JSON.stringify(record)),
    );
    this.announce(store, record);
    return record;
  }

  private async probe(store: Store): Promise<CanaryVerdict> {
    const target = CANARY_TARGETS[store];
    const provider = this.registry.get(store);
    try {
      assertParsedApp(
        await this.egress.through(store, target.country, () =>
          provider.getApp(target.storeAppId, target.country),
        ),
      );
      assertSearchResults(
        await this.egress.through(store, target.country, () =>
          provider.search(target.term, target.country, CANARY_SEARCH_RESULTS),
        ),
      );
      return { outcome: 'ok', detail: null };
    } catch (error) {
      return { outcome: outcomeOfError(error), detail: detailOf(error) };
    }
  }

  private async read(store: Store): Promise<StoreCanaryRecord | null> {
    return parseRecord(
      await this.redis.run((client) => client.get(storeCanaryKey(store))),
    );
  }

  private announce(store: Store, record: StoreCanaryRecord): void {
    const line = `${store} canary ${record.outcome}${record.detail ? `: ${record.detail}` : ''}`;
    if (record.outcome === 'broken') {
      this.logger.error(`${line} (${record.consecutiveFailures} consecutive)`);
      return;
    }
    if (record.outcome === 'ok') {
      this.logger.log(line);
      return;
    }
    this.logger.warn(line);
  }
}

function nextRecord(
  previous: StoreCanaryRecord | null,
  verdict: CanaryVerdict,
  checkedAt: string,
): StoreCanaryRecord {
  if (verdict.outcome !== 'broken') {
    return {
      ...verdict,
      checkedAt,
      failingSince: null,
      consecutiveFailures: 0,
    };
  }
  return {
    ...verdict,
    checkedAt,
    failingSince: previous?.failingSince ?? checkedAt,
    consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
  };
}

function parseRecord(stored: string | null): StoreCanaryRecord | null {
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is StoreCanaryRecord {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StoreCanaryRecord>;
  return (
    CANARY_OUTCOMES.includes(candidate.outcome as CanaryOutcome) &&
    typeof candidate.checkedAt === 'string' &&
    typeof candidate.consecutiveFailures === 'number'
  );
}

function detailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
