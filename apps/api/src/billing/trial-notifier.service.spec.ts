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
  plan: string;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialNoticeDay: number | null;
  billingInterval: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  firstPaidAt: Date | null;
  planExpiresAt: Date | null;
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
      } as unknown as AccountNotifier,
      {
        get: (key: string) => (key === 'BILLING_ENABLED' ? billing : 7),
      } as unknown as ConfigService<Env, true>,
    );

    return { notifier, notify, update, findMany };
  };

  const row = (over: Partial<Row> = {}): Row => ({
    id: 'ws_1',
    plan: 'trial',
    trialStartedAt: START,
    trialEndsAt: ENDS,
    trialNoticeDay: null,
    billingInterval: null,
    cancelAtPeriodEnd: false,
    subscriptionId: null,
    subscriptionStatus: null,
    firstPaidAt: null,
    planExpiresAt: null,
    ...over,
  });

  const cardTrial = (over: Partial<Row> = {}): Row =>
    row({
      plan: 'indie',
      billingInterval: 'month',
      subscriptionId: 'sub_1',
      subscriptionStatus: 'trialing',
      planExpiresAt: ENDS,
      ...over,
    });

  const mailOf = (notify: jest.Mock) =>
    notify.mock.calls[0] as [
      string,
      string,
      { body: string[]; action?: { label: string } },
    ];

  const at = (days: number) => new Date(START.getTime() + days * DAY_MS);

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

  it('asks for legacy trials and card trials, never a plain purchase', async () => {
    const { notifier, findMany } = build(true, []);

    await notifier.sweep(START);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          trialStartedAt: { not: null },
          OR: [{ trialNoticeDay: null }, { trialNoticeDay: { lt: 8 } }],
          AND: [
            {
              OR: [{ subscriptionId: null }, { trialClaimedAt: { not: null } }],
            },
          ],
        },
      }) as Record<string, unknown>,
    );
  });

  it('notifies a card trial with its plan, its length and its price', async () => {
    const { notifier, notify } = build(true, [cardTrial()]);

    await notifier.sweep(START);

    const [, event, mail] = mailOf(notify);
    expect(event).toBe('trial.day0');
    expect(mail.body[0]).toBe(
      'Your 7 day trial of Indie runs until 2026-08-08.',
    );
    expect(mail.body.join(' ')).toContain('your card is charged $10 per month');
  });

  it('notifies a legacy trial with the copy it started with', async () => {
    const { notifier, notify } = build(true, [row()]);

    await notifier.sweep(START);

    expect(mailOf(notify)[2].body[0]).toBe(
      'Your trial runs until 2026-08-08, with the full Indie limits.',
    );
  });

  it('tells a cancelled card trial that nothing is charged', async () => {
    const { notifier, notify } = build(true, [
      cardTrial({ cancelAtPeriodEnd: true, trialNoticeDay: 5 }),
    ]);

    await notifier.sweep(at(7));

    expect(mailOf(notify)[2].body.join(' ')).toContain('nothing is charged');
  });

  it('skips day 8 for a workspace that is still entitled and records it', async () => {
    const { notifier, notify, update } = build(true, [
      cardTrial({
        subscriptionStatus: 'active',
        planExpiresAt: at(40),
        trialNoticeDay: 7,
      }),
    ]);

    await expect(notifier.sweep(at(8))).resolves.toBe(0);
    expect(notify).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ws_1' },
      data: { trialNoticeDay: 8 },
    });
  });

  it('closes the notices of a trial that bought or converted early', async () => {
    const { notifier, notify, update } = build(true, [
      cardTrial({
        subscriptionStatus: 'active',
        planExpiresAt: at(40),
        trialNoticeDay: 0,
      }),
    ]);

    await notifier.sweep(at(3));

    expect(notify).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ws_1' },
      data: { trialNoticeDay: 8 },
    });
  });

  it('sends day 8 to a cancelled trial with a plan to choose', async () => {
    const { notifier, notify } = build(true, [
      cardTrial({
        plan: 'free',
        subscriptionStatus: 'canceled',
        trialNoticeDay: 7,
      }),
    ]);

    await notifier.sweep(at(8));

    const [, event, mail] = mailOf(notify);
    expect(event).toBe('trial.day8');
    expect(mail.action?.label).toBe('Choose a plan');
  });

  it('sends the card variant of day 8 once the first charge was declined', async () => {
    const { notifier, notify } = build(true, [
      cardTrial({
        plan: 'free',
        subscriptionStatus: 'past_due',
        trialNoticeDay: 5,
      }),
    ]);

    await notifier.sweep(new Date(at(7).getTime() + 60 * 60 * 1000));

    const [, event, mail] = mailOf(notify);
    expect(event).toBe('trial.day8');
    expect(mail.action?.label).toBe('Update your card');
  });
});
