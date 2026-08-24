import { ProxyTier } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { ProxyLedger } from './proxy-ledger.service';

describe('ProxyLedger', () => {
  const upsert = jest.fn();
  const queryRaw = jest.fn<Promise<{ requests: number }[]>, unknown[]>();

  const prisma = {
    proxySpend: { upsert, findUnique: jest.fn() },
    $queryRaw: queryRaw,
  } as unknown as PrismaService;

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
      _justification: string,
      work: () => Promise<T>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const ledger = new ProxyLedger(prisma, crossTenant);

  beforeEach(() => {
    upsert.mockReset().mockResolvedValue(undefined);
    queryRaw.mockReset().mockResolvedValue([{ requests: 1 }]);
  });

  it('charges the month for every request a lease made, not for the lease', async () => {
    await ledger.record(ProxyTier.DATACENTER, 17, '2026-08');

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { month: '2026-08', tier: ProxyTier.DATACENTER, requests: 17 },
        update: { requests: { increment: 17 } },
      }),
    );
  });

  it('writes nothing for a lease that made no request', async () => {
    await ledger.record(ProxyTier.DATACENTER, 0, '2026-08');

    expect(upsert).not.toHaveBeenCalled();
  });

  it('admits a claim the month still has room for', async () => {
    await expect(
      ledger.claim(ProxyTier.RESIDENTIAL, 1, 100, '2026-08'),
    ).resolves.toBe(true);

    const sql = (queryRaw.mock.calls[0][0] as TemplateStringsArray)
      .join(' ')
      .replace(/\s+/g, ' ');
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('WHERE');
    expect(sql).toContain('RETURNING');
  });

  it('refuses the claim the conditional increment declined', async () => {
    queryRaw.mockResolvedValue([]);

    await expect(
      ledger.claim(ProxyTier.RESIDENTIAL, 1, 100, '2026-08'),
    ).resolves.toBe(false);
  });

  it('refuses a claim larger than the whole month cap without asking', async () => {
    await expect(
      ledger.claim(ProxyTier.RESIDENTIAL, 101, 100, '2026-08'),
    ).resolves.toBe(false);

    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('admits a claim for nothing rather than writing a zero row', async () => {
    await expect(
      ledger.claim(ProxyTier.RESIDENTIAL, 0, 0, '2026-08'),
    ).resolves.toBe(true);

    expect(queryRaw).not.toHaveBeenCalled();
  });
});
