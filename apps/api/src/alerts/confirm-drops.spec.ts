import { AlertPayload } from '@asobeast/shared';
import {
  confirmDropsWhere,
  DropAudience,
  dropAudienceOf,
  reachesChannel,
} from './confirm-drops';
import {
  drop,
  firstRanking,
  improvement,
  milestone,
  overtake,
} from './rank-events.fixture';

const metadataChange: AlertPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'a', name: 'My App', isCompetitor: false },
  changes: [],
};

const batch: AlertPayload = {
  event: 'alerts.batch',
  scope: 'owned_apps',
  occurredAt: '2026-07-22T11:00:00.000Z',
  window: {
    from: '2026-07-22T09:00:00.000Z',
    to: '2026-07-22T11:00:00.000Z',
  },
  totals: { events: 0, apps: 0 },
  apps: [],
  events: [],
};

describe('dropAudienceOf', () => {
  it.each<{
    name: string;
    payload: AlertPayload;
    audience: DropAudience;
    plain: boolean;
    confirming: boolean;
  }>([
    {
      name: 'an unmarked drop',
      payload: drop(),
      audience: 'ordinary',
      plain: true,
      confirming: false,
    },
    {
      name: 'a confirmed drop',
      payload: drop({ confirmed: true }),
      audience: 'confirming',
      plain: false,
      confirming: true,
    },
    {
      name: 'an unmarked leave',
      payload: milestone({ direction: 'left' }),
      audience: 'ordinary',
      plain: true,
      confirming: false,
    },
    {
      name: 'a confirmed leave',
      payload: milestone({ direction: 'left', confirmed: true }),
      audience: 'confirming',
      plain: false,
      confirming: true,
    },
    {
      name: 'an unmarked entry',
      payload: milestone(),
      audience: 'everyone',
      plain: true,
      confirming: true,
    },
    {
      name: 'an undoing entry',
      payload: milestone({ undoesDrop: true }),
      audience: 'ordinary',
      plain: true,
      confirming: false,
    },
    {
      name: 'an unmarked improvement',
      payload: improvement(),
      audience: 'everyone',
      plain: true,
      confirming: true,
    },
    {
      name: 'an undoing improvement',
      payload: improvement({ undoesDrop: true }),
      audience: 'ordinary',
      plain: true,
      confirming: false,
    },
    {
      name: 'a first ranking',
      payload: firstRanking(),
      audience: 'everyone',
      plain: true,
      confirming: true,
    },
    {
      name: 'an overtake',
      payload: overtake(),
      audience: 'everyone',
      plain: true,
      confirming: true,
    },
    {
      name: 'a metadata change',
      payload: metadataChange,
      audience: 'everyone',
      plain: true,
      confirming: true,
    },
    {
      name: 'a batch',
      payload: batch,
      audience: 'everyone',
      plain: true,
      confirming: true,
    },
  ])('answers $name', ({ payload, audience, plain, confirming }) => {
    expect(dropAudienceOf(payload)).toBe(audience);
    expect(reachesChannel(payload, false)).toBe(plain);
    expect(reachesChannel(payload, true)).toBe(confirming);
  });
});

describe('confirmDropsWhere', () => {
  it('adds no condition for an event everyone receives', () => {
    expect(confirmDropsWhere(milestone())).toEqual({});
  });

  it('asks for confirming channels for a confirmed event', () => {
    expect(confirmDropsWhere(drop({ confirmed: true }))).toEqual({
      confirmDrops: true,
    });
  });

  it('asks for other channels for an ordinary drop event', () => {
    expect(confirmDropsWhere(drop())).toEqual({ confirmDrops: false });
  });
});
