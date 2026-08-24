import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AccountNotifier } from './account-notifier.service';
import { TrialNotifier } from './trial-notifier.service';

const START = new Date('2026-08-01T00:00:00.000Z');
const ENDS = new Date('2026-08-08T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

interface Row {
  id: string;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialNoticeDay: number | null;
}

describe('TrialNotifier', () => {
  const build = (billing: boolean, rows: Row[]) => {
    const notify = jest.fn().mockResolvedValue('delivered');
    const update = jest.fn().mockResolvedValue({});
    const findMany = jest.fn().mockResolvedValue(rows);

    const notifier = new TrialNotifier(
      { workspace: { findMany, update } } as unknown as PrismaService,
      {
        becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
          _justification: string,
          work: () => Promise<T>,
        ) => work(),
      } as unknown as CrossTenantAccess,
      {
        notify,
        appUrl: 'https://app.example.com',
      } as unknown as AccountNotifier,
      { get: () => billing } as unknown as ConfigService<Env, true>,
    );

    return { notifier, notify, update, findMany };
  };

  const row = (over: Partial<Row> = {}): Row => ({
    id: 'ws_1',
    trialStartedAt: START,
    trialEndsAt: ENDS,
    trialNoticeDay: null,
    ...over,
  });

  it('says nothing on a self hosted instance', async () => {
    const { notifier, findMany } = build(false, [row()]);

    await expect(notifier.sweep(START)).resolves.toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('welcomes a workspace the day its trial opens', async () => {
    const { notifier, notify, update } = build(true, [row()]);

    await expect(notifier.sweep(START)).resolves.toBe(1);
    expect(notify).toHaveBeenCalledWith(
      'ws_1',
      'trial.day0',
      expect.objectContaining({
        subject: 'Your asobeast trial has started',
      }) as Record<string, unknown>,
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ws_1' },
      data: { trialNoticeDay: 0 },
    });
  });

  it('leads the day three message with what the trial collected', async () => {
    const { notifier, notify } = build(true, [row({ trialNoticeDay: 0 })]);

    await notifier.sweep(new Date(START.getTime() + 3 * DAY_MS));

    const [, event, mail] = notify.mock.calls[0] as [
      string,
      string,
      { subject: string; body: string[] },
    ];
    expect(event).toBe('trial.day3');
    expect(mail.subject).toContain('first asobeast rankings');
    expect(mail.body.join(' ')).toContain('action center');
  });

  it('leaves the milestone open when the email could not be sent', async () => {
    const { notifier, notify, update } = build(true, [row()]);
    notify.mockResolvedValue('failed');

    await expect(notifier.sweep(START)).resolves.toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('closes the milestone when there is nobody to email, so it stops retrying', async () => {
    const { notifier, notify, update } = build(true, [row()]);
    notify.mockResolvedValue('skipped');

    await expect(notifier.sweep(START)).resolves.toBe(0);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ws_1' },
      data: { trialNoticeDay: 0 },
    });
  });

  it('sends nothing twice for the same milestone', async () => {
    const { notifier, notify } = build(true, [row({ trialNoticeDay: 0 })]);

    await expect(notifier.sweep(START)).resolves.toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('tells a lapsed trial its data is still there', async () => {
    const { notifier, notify } = build(true, [row({ trialNoticeDay: 7 })]);

    await notifier.sweep(new Date(START.getTime() + 8 * DAY_MS));

    const [, , mail] = notify.mock.calls[0] as [
      string,
      string,
      { body: string[] },
    ];
    expect(mail.body.join(' ')).toContain('nothing has been deleted');
  });

  it('asks only for trialing workspaces that never subscribed', async () => {
    const { notifier, findMany } = build(true, []);

    await notifier.sweep(START);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trialStartedAt: { not: null }, subscriptionId: null },
      }) as Record<string, unknown>,
    );
  });
});
