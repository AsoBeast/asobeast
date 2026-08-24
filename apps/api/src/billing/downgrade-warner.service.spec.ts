import { ConfigService } from '@nestjs/config';
import type { Workspace } from '@prisma/client';
import { PLAN_LIMITS } from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AccountNotifier } from './account-notifier.service';
import { DowngradeWarner } from './downgrade-warner.service';

const NOW = new Date('2026-08-10T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const workspaceOf = (over: Partial<Workspace> = {}): Workspace =>
  ({
    id: 'ws_1',
    plan: 'ultimate',
    pendingPlan: 'indie',
    cancelAtPeriodEnd: false,
    planExpiresAt: new Date(NOW.getTime() + 3 * DAY_MS),
    downgradeWarnedAt: null,
    ...over,
  }) as Workspace;

describe('DowngradeWarner', () => {
  const build = (
    billing: boolean,
    rows: Workspace[],
    usage = { apps: 40, keywordMarkets: 100 },
  ) => {
    const notify = jest.fn().mockResolvedValue('delivered');
    const update = jest.fn().mockResolvedValue({});
    const warner = new DowngradeWarner(
      {
        workspace: { findMany: jest.fn().mockResolvedValue(rows), update },
      } as unknown as PrismaService,
      {
        becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
          _justification: string,
          work: () => Promise<T>,
        ) => work(),
      } as unknown as CrossTenantAccess,
      new WorkspaceContext(),
      {
        usage: () => Promise.resolve({ plan: 'ultimate', ...usage }),
      } as unknown as QuotaService,
      {
        notify,
        appUrl: 'https://app.example.com',
      } as unknown as AccountNotifier,
      { get: () => billing } as unknown as ConfigService<Env, true>,
    );
    return { warner, notify, update };
  };

  it('says nothing on a self hosted instance', async () => {
    const { warner, notify } = build(false, [workspaceOf()]);

    await expect(warner.sweep(NOW)).resolves.toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('names how far over the smaller plan the workspace is', async () => {
    const { warner, notify, update } = build(true, [workspaceOf()]);

    await expect(warner.sweep(NOW)).resolves.toBe(1);
    const [, event, mail] = notify.mock.calls[0] as [
      string,
      string,
      { subject: string; body: string[] },
    ];
    expect(event).toBe('billing.downgrade_warning');
    expect(mail.subject).toContain('Indie');
    expect(mail.body.join(' ')).toContain(
      `40 tracked against a limit of ${PLAN_LIMITS.indie.apps}`,
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ws_1' },
      data: { downgradeWarnedAt: NOW },
    });
  });

  it('stays unwarned when the email could not be sent, so the next sweep retries', async () => {
    const { warner, notify, update } = build(true, [workspaceOf()]);
    notify.mockResolvedValue('failed');

    await expect(warner.sweep(NOW)).resolves.toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('records the warning when there is nobody to email', async () => {
    const { warner, notify, update } = build(true, [workspaceOf()]);
    notify.mockResolvedValue('skipped');

    await expect(warner.sweep(NOW)).resolves.toBe(0);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ws_1' },
      data: { downgradeWarnedAt: NOW },
    });
  });

  it('promises the data is kept rather than deleted', async () => {
    const { warner, notify } = build(true, [workspaceOf()]);

    await warner.sweep(NOW);

    const [, , mail] = notify.mock.calls[0] as [
      string,
      string,
      { body: string[] },
    ];
    expect(mail.body.join(' ')).toContain('Nothing is deleted');
  });

  it('stays quiet when the workspace already fits the smaller plan', async () => {
    const { warner, notify } = build(true, [workspaceOf()], {
      apps: 1,
      keywordMarkets: 1,
    });

    await expect(warner.sweep(NOW)).resolves.toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('leaves a pending cancellation alone rather than calling it a downgrade', async () => {
    const { warner, notify } = build(true, [
      workspaceOf({ pendingPlan: null, cancelAtPeriodEnd: true }),
    ]);

    await expect(warner.sweep(NOW)).resolves.toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('waits until the change is close before warning', async () => {
    const { warner, notify } = build(true, [
      workspaceOf({ planExpiresAt: new Date(NOW.getTime() + 30 * DAY_MS) }),
    ]);

    await expect(warner.sweep(NOW)).resolves.toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });
});
