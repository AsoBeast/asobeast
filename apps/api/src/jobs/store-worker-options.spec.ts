import {
  poolEnabledFromEnv,
  positiveEnv,
  storeWorkerOptions,
} from './store-worker-options';

describe('storeWorkerOptions', () => {
  it('keeps the single host budget when no pool is configured', () => {
    expect(
      storeWorkerOptions({
        poolEnabled: false,
        rpm: 15,
        maxConcurrency: 8,
      }),
    ).toEqual({ concurrency: 1, limiter: { max: 15, duration: 60_000 } });
  });

  it('drops the global limiter once each endpoint carries its own', () => {
    expect(
      storeWorkerOptions({ poolEnabled: true, rpm: 15, maxConcurrency: 8 }),
    ).toEqual({ concurrency: 8 });
  });

  it('never starts a worker that cannot take a job', () => {
    expect(
      storeWorkerOptions({ poolEnabled: true, rpm: 15, maxConcurrency: 0 })
        .concurrency,
    ).toBe(1);
  });
});

describe('storeWorkerOptions environment reading', () => {
  it('treats an unset provider as no pool', () => {
    expect(poolEnabledFromEnv({})).toBe(false);
    expect(poolEnabledFromEnv({ PROXY_PROVIDER: 'none' })).toBe(false);
    expect(poolEnabledFromEnv({ PROXY_PROVIDER: 'webshare' })).toBe(true);
  });

  it('falls back when the configured number is unusable', () => {
    expect(positiveEnv('20', 15)).toBe(20);
    expect(positiveEnv(undefined, 15)).toBe(15);
    expect(positiveEnv('0', 15)).toBe(15);
    expect(positiveEnv('abc', 15)).toBe(15);
  });
});
