import { ProxyOutcome, ProxyTier, Store } from '@prisma/client';
import { Dispatcher } from 'undici';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreRequestError } from '../errors';
import { StoreProviderRegistry } from '../store-provider.registry';
import { HealthObservation, ProxyHealthTracker } from './proxy-health.service';
import { ProxyLedger } from './proxy-ledger.service';
import { ProxyLease, ProxyPool } from './proxy-pool.service';
import { ProxyProbe } from './proxy-probe.service';

describe('ProxyProbe', () => {
  const findMany = jest.fn<Promise<{ id: string }[]>, []>();
  const update = jest.fn();
  const suggest = jest.fn();
  const record = jest.fn<Promise<void>, [string, Store, HealthObservation]>();
  const charge = jest.fn<Promise<void>, [ProxyTier, number?]>();
  const leaseEndpoint = jest.fn<Promise<ProxyLease | null>, [string]>();

  const prisma = {
    proxyEndpoint: { findMany, update },
  } as unknown as PrismaService;

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
      _justification: string,
      work: () => Promise<T>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const probe = new ProxyProbe(
    prisma,
    crossTenant,
    { leaseEndpoint } as unknown as ProxyPool,
    { get: () => ({ suggest }) } as unknown as StoreProviderRegistry,
    { record } as unknown as ProxyHealthTracker,
    { record: charge } as unknown as ProxyLedger,
  );

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([{ id: 'e1' }]);
    update.mockReset().mockResolvedValue(undefined);
    suggest.mockReset().mockResolvedValue([{ term: 'habit tracker' }]);
    record.mockReset().mockResolvedValue(undefined);
    charge.mockReset().mockResolvedValue(undefined);
    leaseEndpoint
      .mockReset()
      .mockResolvedValue({ endpointId: 'e1', dispatcher: {} as Dispatcher });
  });

  it('admits an endpoint only after it answers a live probe', async () => {
    await expect(probe.admitPending()).resolves.toEqual({
      probed: 1,
      enabled: 1,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { enabled: true },
    });
    expect(record).toHaveBeenCalledWith(
      'e1',
      Store.APP_STORE,
      expect.objectContaining({ outcome: ProxyOutcome.SUCCESS }),
    );
  });

  it('leaves an endpoint disabled when the probe is blocked', async () => {
    suggest.mockRejectedValue(
      new StoreRequestError(
        Store.APP_STORE,
        'suggest',
        'Request failed with status 403',
      ),
    );

    await expect(probe.admitPending()).resolves.toEqual({
      probed: 1,
      enabled: 0,
    });

    expect(update).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      'e1',
      Store.APP_STORE,
      expect.objectContaining({ outcome: ProxyOutcome.BLOCKED }),
    );
  });

  it('records an unrecognised probe failure as a transport fault', async () => {
    suggest.mockRejectedValue(new Error('surprise'));

    await probe.admitPending();

    expect(record).toHaveBeenCalledWith(
      'e1',
      Store.APP_STORE,
      expect.objectContaining({ outcome: ProxyOutcome.TRANSPORT }),
    );
  });

  it('never probes an endpoint that has already been retired', async () => {
    await probe.admitPending();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enabled: false, retiredAt: null },
      }) as Record<string, unknown>,
    );
  });

  it('probes in bounded batches so a large pool does not burst', async () => {
    await probe.admitPending(5);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }) as Record<string, unknown>,
    );
  });
});
