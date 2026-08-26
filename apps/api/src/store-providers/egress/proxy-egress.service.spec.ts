import { ProxyOutcome, ProxyTier, Store } from '@prisma/client';
import { Dispatcher } from 'undici';
import { ImplausibleResultError, StoreRequestError } from '../errors';
import { currentMeter } from './egress';
import { ProxyEgress } from './proxy-egress.service';
import { HealthObservation, ProxyHealthTracker } from './proxy-health.service';
import { ProxyLedger } from './proxy-ledger.service';
import { ProxyPoolMaintenance } from './proxy-pool.maintenance';
import { ProxyPoolConfig } from './proxy-pool.config';
import { ProxyLease, ProxyPool } from './proxy-pool.service';
import { ResidentialFallback } from './residential-fallback.service';

const MIN_INTERVAL_MS = 4_000;

describe('ProxyEgress', () => {
  const acquire = jest.fn<Promise<ProxyLease | null>, [Store, string?]>();
  const record = jest.fn<Promise<void>, [string, Store, HealthObservation]>();
  const charge = jest.fn<Promise<void>, [ProxyTier, number?]>();
  const lease: ProxyLease = {
    endpointId: 'e1',
    dispatcher: {} as Dispatcher,
  };

  const claim = jest.fn<Promise<Dispatcher | null>, []>();
  const admit = jest.fn<Promise<void>, []>();
  const ensureInitialized = jest.fn<Promise<void>, []>();

  const egress = new ProxyEgress(
    { acquire } as unknown as ProxyPool,
    {
      enabled: true,
      minIntervalMs: MIN_INTERVAL_MS,
    } as unknown as ProxyPoolConfig,
    { record } as unknown as ProxyHealthTracker,
    { claim, admit } as unknown as ResidentialFallback,
    { record: charge } as unknown as ProxyLedger,
    { ensureInitialized } as unknown as ProxyPoolMaintenance,
  );

  const observationOf = (call = 0): HealthObservation =>
    record.mock.calls[call][2];

  const refusedSubrequests = (count: number) => () => {
    const meter = currentMeter();
    for (let n = 0; n < count; n++) {
      meter?.observe();
      meter?.refuse(new Error('HTTP 403'));
    }
    return Promise.resolve('partial');
  };

  const okSubrequests = (count: number) => () => {
    const meter = currentMeter();
    for (let n = 0; n < count; n++) meter?.observe();
    return Promise.resolve('ok');
  };

  beforeEach(() => {
    acquire.mockReset().mockResolvedValue(lease);
    record.mockReset().mockResolvedValue(undefined);
    charge.mockReset().mockResolvedValue(undefined);
    claim.mockReset().mockResolvedValue(null);
    admit.mockReset().mockResolvedValue(undefined);
    ensureInitialized.mockReset().mockResolvedValue(undefined);
  });

  it('initializes the pool before asking it for an endpoint', async () => {
    const order: string[] = [];
    ensureInitialized.mockImplementation(() => {
      order.push('initialize');
      return Promise.resolve();
    });
    acquire.mockImplementation(() => {
      order.push('acquire');
      return Promise.resolve(lease);
    });

    await egress.through(Store.APP_STORE, 'us', () => Promise.resolve('done'));

    expect(order).toEqual(['initialize', 'acquire']);
  });

  it('runs the work untouched when the pool hands out no endpoint', async () => {
    acquire.mockResolvedValue(null);

    await expect(
      egress.through(Store.APP_STORE, 'us', () => Promise.resolve('done')),
    ).resolves.toBe('done');

    expect(record).not.toHaveBeenCalled();
    expect(charge).not.toHaveBeenCalled();
  });

  it('keeps one endpoint for the whole job when calls nest', async () => {
    await egress.through(Store.APP_STORE, 'us', () =>
      egress.through(Store.APP_STORE, 'us', () => Promise.resolve('inner')),
    );

    expect(acquire).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('credits the endpoint that carried a successful job', async () => {
    await egress.through(Store.APP_STORE, 'us', () => Promise.resolve('ok'));

    expect(record).toHaveBeenCalledWith(
      'e1',
      Store.APP_STORE,
      expect.objectContaining({
        outcome: ProxyOutcome.SUCCESS,
        successes: 1,
        failures: 0,
      }),
    );
  });

  it('charges the ledger every outbound request the job actually made', async () => {
    await egress.through(Store.GOOGLE_PLAY, 'us', okSubrequests(17));

    expect(charge).toHaveBeenCalledWith(ProxyTier.DATACENTER, 17);
    expect(observationOf().successes).toBe(17);
  });

  it('paces the endpoint for the requests beyond the one it was claimed for', async () => {
    const before = Date.now();

    await egress.through(Store.GOOGLE_PLAY, 'us', okSubrequests(8));

    const pacedUntil = observationOf().pacedUntil as Date;
    expect(pacedUntil.getTime()).toBeGreaterThanOrEqual(
      before + 7 * MIN_INTERVAL_MS,
    );
  });

  it('blames the endpoint for subrequests the job swallowed', async () => {
    await expect(
      egress.through(Store.GOOGLE_PLAY, 'us', async () => {
        const meter = currentMeter();
        meter?.observe();
        meter?.observe();
        meter?.refuse(new Error('Request failed with status 403'));
        return Promise.resolve('partial');
      }),
    ).resolves.toBe('partial');

    expect(record).toHaveBeenCalledWith(
      'e1',
      Store.GOOGLE_PLAY,
      expect.objectContaining({
        outcome: ProxyOutcome.BLOCKED,
        successes: 1,
        failures: 1,
      }),
    );
  });

  it('never counts more failures than the requests it observed', async () => {
    await expect(
      egress.through(Store.GOOGLE_PLAY, 'us', refusedSubrequests(3)),
    ).resolves.toBe('partial');

    const observation = observationOf();
    expect(observation.failures).toBe(3);
    expect(observation.successes).toBe(0);
  });

  it('blames the endpoint that carried a blocked job and rethrows', async () => {
    const blocked = new StoreRequestError(
      Store.GOOGLE_PLAY,
      'search',
      'Request failed with status 403',
    );

    await expect(
      egress.through(Store.GOOGLE_PLAY, 'us', () => Promise.reject(blocked)),
    ).rejects.toBe(blocked);

    expect(record).toHaveBeenCalledWith(
      'e1',
      Store.GOOGLE_PLAY,
      expect.objectContaining({ outcome: ProxyOutcome.BLOCKED }),
    );
  });

  it('records one silent outcome and one residential retry for an implausible review feed', async () => {
    const implausible = new ImplausibleResultError(
      Store.APP_STORE,
      'the review feed for 123 came back empty',
    );

    await expect(
      egress.through(Store.APP_STORE, 'us', () => Promise.reject(implausible)),
    ).rejects.toBe(implausible);

    expect(record).toHaveBeenCalledTimes(1);
    expect(observationOf()).toEqual(
      expect.objectContaining({ outcome: ProxyOutcome.SILENT }),
    );
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('retries a blocked request on residential egress once', async () => {
    claim.mockResolvedValue({} as Dispatcher);
    const work = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(
        new StoreRequestError(
          Store.APP_STORE,
          'reviews',
          'Request failed with status 403',
        ),
      )
      .mockResolvedValue('recovered');

    await expect(egress.through(Store.APP_STORE, 'us', work)).resolves.toBe(
      'recovered',
    );

    expect(work).toHaveBeenCalledTimes(2);
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('surfaces the block when residential spend is capped out', async () => {
    const blocked = new StoreRequestError(
      Store.APP_STORE,
      'reviews',
      'Request failed with status 403',
    );

    await expect(
      egress.through(Store.APP_STORE, 'us', () => Promise.reject(blocked)),
    ).rejects.toBe(blocked);

    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('never reaches for residential over a dropped connection', async () => {
    const transport = new StoreRequestError(
      Store.APP_STORE,
      'search',
      'socket hang up',
    );

    await expect(
      egress.through(Store.APP_STORE, 'us', () => Promise.reject(transport)),
    ).rejects.toBe(transport);

    expect(claim).not.toHaveBeenCalled();
  });

  it('leaves health alone when the failure was not about the network', async () => {
    const domain = new Error('app not found');

    await expect(
      egress.through(Store.APP_STORE, 'us', () => Promise.reject(domain)),
    ).rejects.toBe(domain);

    expect(record).not.toHaveBeenCalled();
    expect(charge).toHaveBeenCalledWith(ProxyTier.DATACENTER, 1);
  });
});
