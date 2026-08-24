import { ProxyTier } from '@prisma/client';
import { ProxyLedger } from './proxy-ledger.service';
import { ProxyPoolConfig } from './proxy-pool.config';
import {
  ResidentialCapReached,
  ResidentialFallback,
} from './residential-fallback.service';

jest.mock('./egress', () => ({
  proxyDispatcher: jest.fn((origin: string) => ({ origin })),
}));

import { proxyDispatcher } from './egress';

const dispatcherMock = proxyDispatcher as unknown as jest.Mock;

describe('ResidentialFallback', () => {
  const count = jest.fn<Promise<number>, [ProxyTier, string?]>();
  const record = jest.fn<Promise<void>, [ProxyTier, number?, string?]>();
  const claim = jest.fn<
    Promise<boolean>,
    [ProxyTier, number, number, string?]
  >();

  const ledger = { count, record, claim } as unknown as ProxyLedger;

  const configWith = (over: Record<string, unknown> = {}) =>
    ({
      residentialUrl: 'http://residential.example:9000',
      residentialCredentials: { username: 'res', password: 'secret' },
      residentialTariff: {
        mbPerRequest: 1024,
        costPerGb: 1,
        monthlyCapUsd: 2,
      },
      ...over,
    }) as unknown as ProxyPoolConfig;

  const fallbackWith = (over: Record<string, unknown> = {}) =>
    new ResidentialFallback(ledger, configWith(over));

  beforeEach(() => {
    count.mockReset().mockResolvedValue(0);
    record.mockReset().mockResolvedValue(undefined);
    claim
      .mockReset()
      .mockImplementation((_tier, requests, ceiling) =>
        Promise.resolve(requests <= ceiling),
      );
    dispatcherMock.mockClear();
  });

  it('stays unavailable until an operator configures a residential gateway', async () => {
    const fallback = fallbackWith({ residentialUrl: undefined });

    await expect(fallback.claim()).resolves.toBeNull();

    expect(fallback.configured).toBe(false);
    expect(claim).not.toHaveBeenCalled();
  });

  it('hands out the gateway while the month still has room', async () => {
    const dispatcher = await fallbackWith().claim();

    expect(dispatcher).not.toBeNull();
    expect(dispatcherMock).toHaveBeenCalledWith(
      'http://residential.example:9000',
      { username: 'res', password: 'secret' },
    );
  });

  it('claims exactly one request from the ledger per outbound request', async () => {
    await fallbackWith().admit();

    expect(claim).toHaveBeenCalledWith(
      ProxyTier.RESIDENTIAL,
      1,
      2,
      expect.stringMatching(/^\d{4}-\d{2}$/) as string,
    );
  });

  it('never claims capacity merely for handing out the gateway', async () => {
    await fallbackWith().claim();

    expect(claim).not.toHaveBeenCalled();
  });

  it('refuses the request the ledger will not admit', async () => {
    claim.mockResolvedValue(false);

    await expect(fallbackWith().admit()).rejects.toThrow(ResidentialCapReached);
  });

  it('names the cap it refused for', async () => {
    claim.mockResolvedValue(false);

    await expect(fallbackWith().admit()).rejects.toThrow(
      'the monthly 2 USD cap of 2 requests is spent',
    );
  });

  it('refuses to hand out the gateway once the month is spent', async () => {
    count.mockResolvedValue(2);

    await expect(fallbackWith().claim()).resolves.toBeNull();

    expect(dispatcherMock).not.toHaveBeenCalled();
  });

  it('refuses every fallback while no budget is set', async () => {
    const noBudget = {
      residentialTariff: { mbPerRequest: 1, costPerGb: 3, monthlyCapUsd: 0 },
    };

    await expect(fallbackWith(noBudget).claim()).resolves.toBeNull();
    await expect(fallbackWith(noBudget).admit()).rejects.toThrow(
      ResidentialCapReached,
    );
    expect(count).not.toHaveBeenCalled();
  });

  it('reports month to date spend against the cap', async () => {
    count.mockResolvedValue(1);

    await expect(fallbackWith().spend()).resolves.toMatchObject({
      requests: 1,
      usd: 1,
      capUsd: 2,
    });
  });

  it('opens one gateway connection pool, not one per fallback', async () => {
    const fallback = fallbackWith();

    await fallback.claim();
    await fallback.claim();

    expect(dispatcherMock).toHaveBeenCalledTimes(1);
  });
});
