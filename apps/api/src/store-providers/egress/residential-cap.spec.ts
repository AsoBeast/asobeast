import { ProxyTier, Store } from '@prisma/client';

jest.mock('undici', () => ({
  fetch: jest.fn(() => Promise.resolve({ status: 200 })),
  ProxyAgent: jest.fn(() => ({ agent: 'residential' })),
}));

import { Dispatcher } from 'undici';
import { StoreRequestError } from '../errors';
import { egressFetch } from './egress';
import { ProxyEgress } from './proxy-egress.service';
import { ProxyHealthTracker } from './proxy-health.service';
import { ProxyLedger } from './proxy-ledger.service';
import { ProxyPoolConfig } from './proxy-pool.config';
import { ProxyLease, ProxyPool } from './proxy-pool.service';
import { ProxyPoolMaintenance } from './proxy-pool.maintenance';
import { ResidentialFallback } from './residential-fallback.service';

const CEILING = 3;

function countingLedger() {
  const spent: Record<string, number> = {
    [ProxyTier.DATACENTER]: 0,
    [ProxyTier.RESIDENTIAL]: 0,
  };
  const ledger = {
    record: (tier: ProxyTier, requests = 1) => {
      spent[tier] += requests;
      return Promise.resolve();
    },
    claim: (tier: ProxyTier, requests: number, ceiling: number) => {
      if (requests > ceiling) return Promise.resolve(false);
      if (spent[tier] + requests > ceiling) return Promise.resolve(false);
      spent[tier] += requests;
      return Promise.resolve(true);
    },
    count: (tier: ProxyTier) => Promise.resolve(spent[tier]),
  };
  return { ledger: ledger as unknown as ProxyLedger, spent };
}

const blocked = () =>
  new StoreRequestError(
    Store.GOOGLE_PLAY,
    'search',
    'Request failed with status 403',
  );

describe('residential monthly cap', () => {
  const acquire = jest.fn<Promise<ProxyLease | null>, [Store, string?]>();
  const record = jest.fn().mockResolvedValue(undefined);
  const ensureInitialized = jest.fn().mockResolvedValue(undefined);

  const config = {
    enabled: true,
    minIntervalMs: 0,
    residentialUrl: 'http://residential.example:9000',
    residentialCredentials: { username: 'res', password: 'secret' },
    residentialTariff: {
      mbPerRequest: 1024,
      costPerGb: 1,
      monthlyCapUsd: CEILING,
    },
  } as unknown as ProxyPoolConfig;

  function egressWith(ledger: ProxyLedger) {
    return new ProxyEgress(
      { acquire } as unknown as ProxyPool,
      config,
      { record } as unknown as ProxyHealthTracker,
      new ResidentialFallback(ledger, config),
      ledger,
      { ensureInitialized } as unknown as ProxyPoolMaintenance,
    );
  }

  const fanOut = (requests: number) => {
    let attempt = 0;
    return async () => {
      attempt += 1;
      if (attempt === 1) {
        await egressFetch('https://play.google.com/store/search');
        throw blocked();
      }
      for (let n = 0; n < requests; n++) {
        await egressFetch(`https://play.google.com/store/apps/${n}`);
      }
      return 'recovered';
    };
  };

  beforeEach(() => {
    acquire.mockReset().mockResolvedValue({
      endpointId: 'e1',
      dispatcher: {} as Dispatcher,
    });
    record.mockClear();
    ensureInitialized.mockClear();
  });

  it('stops a fan-out retry at the ceiling instead of spending past it', async () => {
    const { ledger, spent } = countingLedger();

    await expect(
      egressWith(ledger).through(Store.GOOGLE_PLAY, 'us', fanOut(10)),
    ).rejects.toThrow(/cap/i);

    expect(spent[ProxyTier.RESIDENTIAL]).toBe(CEILING);
  });

  it('completes a retry that fits inside the ceiling', async () => {
    const { ledger, spent } = countingLedger();

    await expect(
      egressWith(ledger).through(Store.GOOGLE_PLAY, 'us', fanOut(2)),
    ).resolves.toBe('recovered');

    expect(spent[ProxyTier.RESIDENTIAL]).toBe(2);
  });

  it('refuses the retry outright once the month is already spent', async () => {
    const { ledger, spent } = countingLedger();
    await ledger.record(ProxyTier.RESIDENTIAL, CEILING);

    await expect(
      egressWith(ledger).through(Store.GOOGLE_PLAY, 'us', fanOut(1)),
    ).rejects.toThrow(StoreRequestError);

    expect(spent[ProxyTier.RESIDENTIAL]).toBe(CEILING);
  });

  it('never leaves the datacenter tier charged against the residential cap', async () => {
    const { ledger, spent } = countingLedger();

    await egressWith(ledger)
      .through(Store.GOOGLE_PLAY, 'us', fanOut(1))
      .catch(() => undefined);

    expect(spent[ProxyTier.DATACENTER]).toBeGreaterThan(0);
    expect(spent[ProxyTier.RESIDENTIAL]).toBeLessThanOrEqual(CEILING);
  });
});
