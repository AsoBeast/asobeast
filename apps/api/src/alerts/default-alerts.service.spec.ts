import type { ConfigService } from '@nestjs/config';
import type { EmailAlertItem } from '@asobeast/shared';
import { ESSENTIAL_ALERT_EVENTS } from '@asobeast/shared';
import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { DefaultAlertsService } from './default-alerts.service';
import type { EmailAlertsService } from './email-alerts.service';
import type { MailerService } from './mailer.service';

interface State {
  enabled?: boolean;
  origin?: string | null;
  settled?: boolean;
  ranked?: boolean;
  owner?: { email: string; emailVerifiedAt: Date | null } | null;
  billing?: boolean;
  created?: Partial<EmailAlertItem> | null;
}

const VERIFIED = {
  email: 'owner@example.com',
  emailVerifiedAt: new Date('2026-11-01T00:00:00.000Z'),
};

const build = (state: State = {}) => {
  const createDefault = jest
    .fn()
    .mockResolvedValue(
      state.created === undefined ? { confirmed: true } : state.created,
    );
  const workspaceFind = jest.fn().mockResolvedValue({
    defaultAlertsAt: state.settled ? new Date() : null,
  });
  const rankingFind = jest
    .fn()
    .mockResolvedValue(state.ranked === false ? null : { appId: 'a' });
  const ownerFind = jest
    .fn()
    .mockResolvedValue(state.owner === undefined ? VERIFIED : state.owner);
  const service = new DefaultAlertsService(
    {
      workspace: { findFirst: workspaceFind },
      keywordRanking: { findFirst: rankingFind },
      user: { findFirst: ownerFind },
    } as unknown as PrismaService,
    {
      enabled: state.enabled ?? true,
      origin:
        state.origin === undefined ? 'https://aso.example.com' : state.origin,
    } as MailerService,
    { get: () => state.billing ?? false } as unknown as ConfigService<
      Env,
      true
    >,
    { createDefault } as unknown as EmailAlertsService,
  );
  return { service, createDefault, rankingFind };
};

describe('DefaultAlertsService.createFor', () => {
  it.each<[string, State, string]>([
    ['SMTP off', { enabled: false }, 'skipped'],
    ['a plain http origin', { origin: 'http://localhost:3001' }, 'skipped'],
    ['no origin', { origin: null }, 'skipped'],
    ['a settled workspace', { settled: true }, 'settled'],
    ['no primary app ranked today', { ranked: false }, 'not_due'],
    ['no owner', { owner: null }, 'waiting'],
    [
      'an unverified owner on a billing instance',
      { billing: true, owner: { ...VERIFIED, emailVerifiedAt: null } },
      'waiting',
    ],
    ['a verified owner', {}, 'created'],
    [
      'an unverified owner on a self hosted instance',
      {
        owner: { ...VERIFIED, emailVerifiedAt: null },
        created: { confirmed: false },
      },
      'unconfirmed',
    ],
    ['a create that lost the marker', { created: null }, 'settled'],
  ])('answers %s with %s', async (_name, state, outcome) => {
    const { service } = build(state);

    await expect(service.createFor('2026-11-04')).resolves.toBe(outcome);
  });

  it('creates the essential subscription for the owner', async () => {
    const { service, createDefault } = build();

    await service.createFor('2026-11-04');

    expect(createDefault).toHaveBeenCalledWith('owner@example.com', {
      events: [...ESSENTIAL_ALERT_EVENTS],
      rankDropThreshold: 10,
      confirmDrops: true,
    });
  });

  it('counts a primary app ranked on the day as due', async () => {
    const { service, rankingFind } = build();

    await service.createFor('2026-11-04');

    expect(rankingFind).toHaveBeenCalledWith({
      where: {
        date: new Date('2026-11-04T00:00:00.000Z'),
        app: { isCompetitor: false },
      },
      select: { appId: true },
    });
  });

  it('touches nothing before mail works', async () => {
    const { service, createDefault, rankingFind } = build({ enabled: false });

    await service.createFor('2026-11-04');

    expect(rankingFind).not.toHaveBeenCalled();
    expect(createDefault).not.toHaveBeenCalled();
  });
});
