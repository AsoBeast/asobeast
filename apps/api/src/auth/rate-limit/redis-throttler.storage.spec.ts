import { Queue } from 'bullmq';
import { RedisThrottlerStorage, throttlerKey } from './redis-throttler.storage';
import { trackerOf } from './request-tracker';
import type { AccountUser } from '../auth.types';

const TTL_MS = 60_000;
const LIMIT = 3;

describe('RedisThrottlerStorage', () => {
  const incr = jest.fn<Promise<number>, [string]>();
  const pexpire = jest.fn<Promise<number>, [string, number]>();
  const pttl = jest.fn<Promise<number>, [string]>();
  const set = jest.fn<Promise<unknown>, [string, string, 'PX', number]>();

  const queue = {
    getBackend: () => ({
      client: Promise.resolve({ incr, pexpire, pttl, set }),
    }),
  } as unknown as Queue;

  const storage = new RedisThrottlerStorage(queue);
  const increment = (name = 'default') =>
    storage.increment('ws:acme', TTL_MS, LIMIT, TTL_MS, name);

  beforeEach(() => {
    incr.mockReset().mockResolvedValue(1);
    pexpire.mockReset().mockResolvedValue(1);
    pttl.mockReset().mockResolvedValue(TTL_MS);
    set.mockReset().mockResolvedValue('OK');
  });

  it('counts in redis so every instance shares one window', async () => {
    await increment();

    expect(incr).toHaveBeenCalledWith(throttlerKey('default', 'ws:acme'));
  });

  it('opens the window on the first hit only', async () => {
    await increment();
    incr.mockResolvedValue(2);
    await increment();

    expect(pexpire).toHaveBeenCalledTimes(1);
    expect(pexpire).toHaveBeenCalledWith(
      throttlerKey('default', 'ws:acme'),
      TTL_MS,
    );
  });

  it('reports the seconds left in the window', async () => {
    pttl.mockResolvedValue(30_000);

    await expect(increment()).resolves.toMatchObject({
      totalHits: 1,
      timeToExpire: 30,
      isBlocked: false,
    });
  });

  it('reopens a window redis lost the expiry for', async () => {
    incr.mockResolvedValue(2);
    pttl.mockResolvedValue(-1);

    await expect(increment()).resolves.toMatchObject({ timeToExpire: 60 });
    expect(pexpire).toHaveBeenCalledWith(
      throttlerKey('default', 'ws:acme'),
      TTL_MS,
    );
  });

  it('blocks once the hits pass the limit', async () => {
    incr.mockResolvedValue(LIMIT + 1);
    pttl.mockResolvedValueOnce(TTL_MS).mockResolvedValueOnce(-2);

    await expect(increment()).resolves.toMatchObject({
      isBlocked: true,
      timeToBlockExpire: 60,
    });
    expect(set).toHaveBeenCalledWith(
      `${throttlerKey('default', 'ws:acme')}:blocked`,
      '1',
      'PX',
      TTL_MS,
    );
  });

  it('keeps counting down an existing block instead of extending it', async () => {
    incr.mockResolvedValue(LIMIT + 2);
    pttl.mockResolvedValueOnce(TTL_MS).mockResolvedValueOnce(12_000);

    await expect(increment()).resolves.toMatchObject({
      timeToBlockExpire: 12,
    });
    expect(set).not.toHaveBeenCalled();
  });

  it('keeps named throttlers in separate windows', async () => {
    await increment('default');
    await increment('minute');

    expect(new Set(incr.mock.calls.map(([key]) => key)).size).toBe(2);
  });
});

describe('trackerOf', () => {
  it('keys an authenticated request by workspace', () => {
    const user = { workspaceId: 'ws_acme' } as AccountUser;

    expect(trackerOf({ user, ip: '203.0.113.7' })).toBe('ws:ws_acme');
  });

  it('falls back to the client ip when nobody is signed in', () => {
    expect(trackerOf({ ip: '203.0.113.7' })).toBe('ip:203.0.113.7');
  });

  it('still produces a key when express cannot name the client', () => {
    expect(trackerOf({})).toBe('ip:unknown');
  });
});
