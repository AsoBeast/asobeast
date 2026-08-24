import { Queue } from 'bullmq';
import { DAY_SECONDS } from '@asobeast/shared';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { ABUSE_REFUSALS_PER_DAY, AbuseMonitor } from './abuse-monitor.service';
import { windowKey } from '../rate-limit/window';

const NOW = new Date('2026-08-14T10:30:30Z');
const REFUSED = {
  workspaceId: 'ws_noisy',
  method: 'POST',
  route: '/apps/:id/refresh',
  rateClass: 'store' as const,
};

describe('AbuseMonitor', () => {
  const incr = jest.fn<Promise<number>, [string]>();
  const expire = jest.fn<Promise<number>, [string, number]>();
  const exists = jest.fn<Promise<number>, [string]>();
  const set = jest.fn<Promise<unknown>, [string, string, 'EX', number]>();
  const update = jest.fn().mockResolvedValue({});

  const queue = {
    getBackend: () => ({
      client: Promise.resolve({ incr, expire, exists, set }),
    }),
  } as unknown as Queue;
  const prisma = { workspace: { update } } as unknown as PrismaService;
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: (
      _why: string,
      work: () => unknown,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const monitor = new AbuseMonitor(queue, prisma, crossTenant);

  beforeEach(() => {
    incr.mockReset().mockResolvedValue(1);
    expire.mockReset().mockResolvedValue(1);
    exists.mockReset().mockResolvedValue(0);
    set.mockReset().mockResolvedValue('OK');
    update.mockReset().mockResolvedValue({});
  });

  it('counts refusals in a daily window per workspace', async () => {
    await monitor.recordRefusal(REFUSED, NOW);

    expect(incr).toHaveBeenCalledWith(
      windowKey('abuse', 'ws_noisy', 'refusals', DAY_SECONDS, NOW),
    );
    expect(expire).toHaveBeenCalledWith(
      expect.any(String) as string,
      DAY_SECONDS,
    );
  });

  it('leaves an occasional refusal unflagged', async () => {
    incr.mockResolvedValue(ABUSE_REFUSALS_PER_DAY - 1);

    await monitor.recordRefusal(REFUSED, NOW);

    expect(update).not.toHaveBeenCalled();
  });

  it('flags the workspace once it sustains refusals all day', async () => {
    incr.mockResolvedValue(ABUSE_REFUSALS_PER_DAY);

    await monitor.recordRefusal(REFUSED, NOW);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'ws_noisy' },
      data: { abuseFlaggedAt: NOW },
    });
  });

  it('latches the flag for the rest of the day rather than rewriting it', async () => {
    incr.mockResolvedValue(ABUSE_REFUSALS_PER_DAY + 1);
    exists.mockResolvedValue(1);

    await monitor.recordRefusal(REFUSED, NOW);

    expect(update).not.toHaveBeenCalled();
  });

  it('still flags a workspace whose threshold refusal was never persisted', async () => {
    incr.mockResolvedValue(ABUSE_REFUSALS_PER_DAY);
    update.mockRejectedValueOnce(new Error('the write failed'));

    await expect(monitor.recordRefusal(REFUSED, NOW)).rejects.toThrow(
      'the write failed',
    );
    expect(set).not.toHaveBeenCalled();

    incr.mockResolvedValue(ABUSE_REFUSALS_PER_DAY + 1);
    await monitor.recordRefusal(REFUSED, NOW);

    expect(update).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenCalledWith(
      windowKey('abuse', 'ws_noisy', 'flagged', DAY_SECONDS, NOW),
      '1',
      'EX',
      DAY_SECONDS,
    );
  });
});
