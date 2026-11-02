import { ProxyOutcome, ProxyTier, Store } from '@prisma/client';
import { Dispatcher } from 'undici';
import { ImplausibleResultError, StoreRequestError } from '../errors';
import { storeDeadline, withinStoreDeadline } from '../store-deadline';
import { currentMeter } from './egress';
import { ProxyEgress } from './proxy-egress.service';
import { HealthObservation, ProxyHealthTracker } from './proxy-health.service';
import { ProxyLedger } from './proxy-ledger.service';
import { ProxyPoolMaintenance } from './proxy-pool.maintenance';
import { ProxyPoolConfig } from './proxy-pool.config';
import { LeasePacing, ProxyLease, ProxyPool } from './proxy-pool.service';
import { ResidentialFallback } from './residential-fallback.service';

const MIN_INTERVAL_MS = 4_000;

describe('ProxyEgress', () => {
  const acquire = jest.fn<
    Promise<ProxyLease | null>,
    [Store, string?, boolean?]
  >();
  const release = jest.fn<Promise<void>, [string, Store, LeasePacing]>();
  const record = jest.fn<Promise<void>, [string, Store, HealthObservation]>();
  const charge = jest.fn<Promise<void>, [ProxyTier, number?]>();
  const leaseFrom = (leasedAt = new Date()): ProxyLease => ({
    endpointId: 'e1',
    dispatcher: {} as Dispatcher,
    leasedAt,
  });

  const claim = jest.fn<Promise<Dispatcher | null>, []>();
  const admit = jest.fn<Promise<void>, []>();
  const ensureInitialized = jest.fn<Promise<void>, []>();

  const egress = new ProxyEgress(
    { acquire, release } as unknown as ProxyPool,
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
      meter?.settle();
      meter?.refuse(new Error('HTTP 403'));
    }
    return Promise.resolve('partial');
  };

  const okSubrequests = (count: number) => () => {
    const meter = currentMeter();
    for (let n = 0; n < count; n++) meter?.observe();
    meter?.settle();
    return Promise.resolve('ok');
  };

  beforeEach(() => {
    acquire.mockReset().mockImplementation(() => Promise.resolve(leaseFrom()));
    release.mockReset().mockResolvedValue(undefined);
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
      return Promise.resolve(leaseFrom());
    });

    await egress.through(Store.APP_STORE, 'us', () => Promise.resolve('done'));

    expect(order).toEqual(['initialize', 'acquire']);
  });

  it('waits for a local endpoint unless the route says otherwise', async () => {
    await egress.through(Store.GOOGLE_PLAY, 'de', () => Promise.resolve('job'));
    await egress.through(
      Store.GOOGLE_PLAY,
      'de',
      () => Promise.resolve('ask'),
      {
        waitForLocal: false,
      },
    );

    expect(acquire.mock.calls).toEqual([
      [Store.GOOGLE_PLAY, 'de', true],
      [Store.GOOGLE_PLAY, 'de', false],
    ]);
  });

  it('hands the endpoint back once when the ledger fails after the work succeeded', async () => {
    const ledgerDown = new Error('ledger unavailable');
    charge.mockRejectedValue(ledgerDown);
    const work = jest.fn(okSubrequests(3));

    await expect(egress.through(Store.GOOGLE_PLAY, 'us', work)).rejects.toBe(
      ledgerDown,
    );

    expect(work).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(observationOf().outcome).toBe(ProxyOutcome.SUCCESS);
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

  it('paces the endpoint for every request the job made', async () => {
    const before = Date.now();

    await egress.through(Store.GOOGLE_PLAY, 'us', okSubrequests(8));

    const until = observationOf().pacing?.until.getTime() ?? 0;
    expect(until).toBeGreaterThanOrEqual(before + 8 * MIN_INTERVAL_MS);
  });

  it('measures the pacing from the moment the lease began', async () => {
    const leasedAt = new Date(Date.now() - 10_000);
    acquire.mockResolvedValue(leaseFrom(leasedAt));

    await egress.through(Store.GOOGLE_PLAY, 'us', okSubrequests(8));

    expect(observationOf().pacing).toEqual({
      leasedAt,
      until: new Date(leasedAt.getTime() + 8 * MIN_INTERVAL_MS),
    });
  });

  it('spaces the next lease one interval after a slow job that outran its pacing', async () => {
    acquire.mockResolvedValue(leaseFrom(new Date(Date.now() - 600_000)));
    const before = Date.now();

    await egress.through(Store.GOOGLE_PLAY, 'us', okSubrequests(8));

    const until = observationOf().pacing?.until.getTime() ?? 0;
    expect(until).toBeGreaterThanOrEqual(before + MIN_INTERVAL_MS);
    expect(until).toBeLessThanOrEqual(Date.now() + MIN_INTERVAL_MS);
  });

  it('keeps the endpoint one interval after a single request that started late', async () => {
    acquire.mockResolvedValue(leaseFrom(new Date(Date.now() - 600_000)));
    const before = Date.now();

    await egress.through(Store.APP_STORE, 'us', okSubrequests(1));

    const until = observationOf().pacing?.until.getTime() ?? 0;
    expect(until).toBeGreaterThanOrEqual(before + MIN_INTERVAL_MS);
    expect(until).toBeLessThanOrEqual(Date.now() + MIN_INTERVAL_MS);
  });

  it('frees a job that made no request once its claim interval passed', async () => {
    const leasedAt = new Date();
    acquire.mockResolvedValue(leaseFrom(leasedAt));

    await egress.through(Store.APP_STORE, 'us', () => Promise.resolve('none'));

    expect(observationOf().pacing?.until).toEqual(
      new Date(leasedAt.getTime() + MIN_INTERVAL_MS),
    );
  });

  it('blames the endpoint for subrequests the job swallowed', async () => {
    await expect(
      egress.through(Store.GOOGLE_PLAY, 'us', async () => {
        const meter = currentMeter();
        meter?.observe();
        meter?.settle();
        meter?.observe();
        meter?.settle();
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

  it('releases and paces the endpoint of a job that failed for another reason', async () => {
    const leasedAt = new Date();
    acquire.mockResolvedValue(leaseFrom(leasedAt));
    const parse = new StoreRequestError(
      Store.GOOGLE_PLAY,
      'search',
      'ParseError: search root: required script root missing',
    );

    await expect(
      egress.through(Store.GOOGLE_PLAY, 'us', () => {
        const meter = currentMeter();
        for (let n = 0; n < 5; n++) meter?.observe();
        meter?.settle();
        return Promise.reject(parse);
      }),
    ).rejects.toBe(parse);

    expect(record).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith('e1', Store.GOOGLE_PLAY, {
      leasedAt,
      until: new Date(leasedAt.getTime() + 5 * MIN_INTERVAL_MS),
    });
  });

  it('never holds a passed on demand deadline against the endpoint', async () => {
    const failure = await withinStoreDeadline(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return egress
        .through(Store.APP_STORE, 'us', () => {
          const meter = currentMeter();
          meter?.observe();
          meter?.settle();
          meter?.refuse(storeDeadline().signal?.reason);
          return Promise.reject(
            new StoreRequestError(
              Store.APP_STORE,
              'getApp',
              'The operation was aborted due to timeout',
            ),
          );
        })
        .catch((error: unknown) => error);
    }, 20);

    expect(failure).toBeInstanceOf(StoreRequestError);
    expect(record).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledWith(ProxyTier.DATACENTER, 1);
  });
});
