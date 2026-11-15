import { ADMIN_COHORT_WEEKS } from '@asobeast/shared';
import {
  conversionOf,
  departureTallyOf,
  median,
  weekStartOf,
  type ConversionInput,
  type FunnelWorkspace,
} from './conversion-tallies';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

let sequence = 0;

const workspace = (
  overrides: Partial<FunnelWorkspace> = {},
): FunnelWorkspace => ({
  id: `ws_${(sequence += 1)}`,
  createdAt: ago(5),
  plan: 'free',
  trialEndsAt: null,
  planExpiresAt: null,
  subscriptionId: null,
  subscriptionStatus: null,
  trialStartedAt: null,
  firstPaidAt: null,
  confirmedEmail: false,
  firstAppAt: null,
  rankedWithinADay: false,
  ...overrides,
});

const CUSTOMER = workspace({
  createdAt: ago(20),
  confirmedEmail: true,
  firstAppAt: ago(19),
  rankedWithinADay: true,
  plan: 'indie',
  planExpiresAt: ago(-20),
  subscriptionId: 'sub_paid',
  subscriptionStatus: 'active',
  trialStartedAt: ago(18),
  trialEndsAt: ago(11),
  firstPaidAt: ago(11),
});

const TRIAL = workspace({
  createdAt: ago(3),
  confirmedEmail: true,
  firstAppAt: ago(2),
  plan: 'indie',
  planExpiresAt: ago(-2),
  subscriptionId: 'sub_trial',
  subscriptionStatus: 'trialing',
  trialStartedAt: ago(1),
  trialEndsAt: ago(-2),
});

const LAPSED = workspace({
  createdAt: ago(25),
  confirmedEmail: true,
  subscriptionId: 'sub_lapsed',
  subscriptionStatus: 'canceled',
  trialStartedAt: ago(24),
  trialEndsAt: ago(17),
});

const SIGNED_UP = workspace({ createdAt: ago(1) });

const OPERATOR = workspace({ id: 'ws_default', createdAt: ago(2) });

const COMPED = workspace({
  createdAt: ago(4),
  plan: 'ultimate',
  confirmedEmail: true,
});

const ROWS = [CUSTOMER, TRIAL, LAPSED, SIGNED_UP, OPERATOR, COMPED];

const input = (overrides: Partial<ConversionInput> = {}): ConversionInput => ({
  billing: true,
  days: 30,
  now: NOW,
  funnel: ROWS,
  workspaces: ROWS,
  departures: [],
  departuresRecordedSince: '2026-11-15',
  ...overrides,
});

describe('conversionOf', () => {
  it('walks the window from sign up to paid, leaving out the operator and comped workspaces', () => {
    expect(conversionOf(input()).funnel).toEqual([
      { key: 'signed-up', count: 4 },
      { key: 'confirmed-email', count: 3 },
      { key: 'first-app', count: 2 },
      { key: 'ranked-within-a-day', count: 1 },
      { key: 'trial-started', count: 3 },
      { key: 'paid', count: 1 },
    ]);
  });

  it('counts only sign ups inside the window', () => {
    const funnel = conversionOf(input({ days: 30, now: ago(-10) })).funnel;

    expect(funnel[0]).toEqual({ key: 'signed-up', count: 3 });
  });

  it('rates trials that ended in the window against those of the window before', () => {
    const early = workspace({
      createdAt: ago(60),
      trialStartedAt: ago(50),
      trialEndsAt: ago(43),
      subscriptionId: 'sub_early',
      subscriptionStatus: 'canceled',
    });
    const rates = conversionOf(
      input({ workspaces: [...ROWS, early] }),
    ).trialToPaid;

    expect(rates).toEqual({
      current: { ended: 2, paid: 1 },
      previous: { ended: 1, paid: 0 },
    });
  });

  it('counts trials in progress and those ending within three days', () => {
    const later = {
      ...TRIAL,
      id: 'ws_later',
      trialEndsAt: ago(-6),
      planExpiresAt: ago(-6),
    };

    expect(
      conversionOf(input({ workspaces: [...ROWS, later] })).trials,
    ).toEqual({ inProgress: 2, endingSoon: 1 });
  });

  it('reports the median days to each step', () => {
    expect(conversionOf(input()).medianDays).toEqual({
      signupToFirstApp: 1,
      signupToTrial: 2,
      trialToPaid: 7,
    });
  });

  it('draws eight weekly cohorts ending with the current week', () => {
    const { cohorts } = conversionOf(input());

    expect(cohorts).toHaveLength(ADMIN_COHORT_WEEKS);
    expect(cohorts.at(-1)?.weekStart).toBe('2026-11-09');
    expect(cohorts[0]?.weekStart).toBe('2026-09-21');
    expect(cohorts.at(-1)).toEqual({
      weekStart: '2026-11-09',
      signedUp: 2,
      confirmedEmail: 1,
      firstApp: 1,
      trialStarted: 1,
      paid: 0,
      stillPaying: 0,
    });
    expect(cohorts.find((week) => week.weekStart === '2026-10-26')).toEqual({
      weekStart: '2026-10-26',
      signedUp: 1,
      confirmedEmail: 1,
      firstApp: 1,
      trialStarted: 1,
      paid: 1,
      stillPaying: 1,
    });
  });

  it('leaves every billing step out when billing is off', () => {
    const conversion = conversionOf(input({ billing: false }));

    expect(conversion.funnel.map((step) => step.key)).toEqual([
      'signed-up',
      'confirmed-email',
      'first-app',
      'ranked-within-a-day',
    ]);
    expect(conversion.funnel[0]).toEqual({ key: 'signed-up', count: 5 });
    expect(conversion.trialToPaid).toBeUndefined();
    expect(conversion.trials).toBeUndefined();
    expect(conversion.medianDays).toEqual({ signupToFirstApp: 1 });
    expect(Object.keys(conversion.cohorts[0] ?? {}).sort()).toEqual([
      'confirmedEmail',
      'firstApp',
      'signedUp',
      'weekStart',
    ]);
  });

  it('answers an empty instance with zeros and no medians', () => {
    const conversion = conversionOf(input({ funnel: [], workspaces: [] }));

    expect(conversion.funnel.every((step) => step.count === 0)).toBe(true);
    expect(conversion.medianDays).toEqual({
      signupToFirstApp: null,
      signupToTrial: null,
      trialToPaid: null,
    });
    expect(conversion.trialToPaid?.current).toEqual({ ended: 0, paid: 0 });
  });
});

describe('departureTallyOf', () => {
  it('counts departures by stage and by reason, an unanswered one included', () => {
    const tally = departureTallyOf([
      { stage: 'paying', reason: 'too-expensive' },
      { stage: 'trial-ended', reason: null },
      { stage: 'paying', reason: 'too-expensive' },
    ]);

    expect(tally.total).toBe(3);
    expect(tally.byStage.find((row) => row.key === 'paying')?.count).toBe(2);
    expect(tally.byReason).toEqual([
      { key: 'too-expensive', count: 2 },
      { key: 'missing-feature', count: 0 },
      { key: 'not-using', count: 0 },
      { key: 'switched-tool', count: 0 },
      { key: 'other', count: 0 },
      { key: 'unanswered', count: 1 },
    ]);
  });
});

describe('median', () => {
  it('takes the middle value, or the mean of the two middle values, to one decimal', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([0.04, 0.11])).toBe(0.1);
  });
});

describe('weekStartOf', () => {
  it('starts a week on its utc monday', () => {
    expect(weekStartOf(new Date('2026-11-15T23:00:00.000Z'))).toEqual(
      new Date('2026-11-09T00:00:00.000Z'),
    );
    expect(weekStartOf(new Date('2026-11-16T00:00:00.000Z'))).toEqual(
      new Date('2026-11-16T00:00:00.000Z'),
    );
  });
});
