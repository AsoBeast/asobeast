import { PLAN_NAMES, STORES } from '@asobeast/shared';
import {
  countsByKey,
  signupSeries,
  signupWindowStart,
  tallyWorkspaces,
  type WorkspaceRow,
} from './overview-tallies';

const NOW = new Date('2026-10-03T12:00:00.000Z');
const PAST = new Date('2026-09-01T00:00:00.000Z');
const FUTURE = new Date('2026-11-01T00:00:00.000Z');

const workspace = (overrides: Partial<WorkspaceRow> = {}): WorkspaceRow => ({
  plan: 'free',
  trialEndsAt: null,
  planExpiresAt: null,
  suspendedAt: null,
  deletionDueAt: null,
  ...overrides,
});

const planCount = (
  tally: ReturnType<typeof tallyWorkspaces>,
  plan: (typeof PLAN_NAMES)[number],
) => tally.byPlan.find((row) => row.key === plan)?.count;

describe('signupSeries', () => {
  it('lists thirty utc days ending today, oldest first', () => {
    const series = signupSeries(
      [
        { date: '2026-10-03', count: 2 },
        { date: '2026-09-04', count: 1 },
      ],
      [{ date: '2026-10-03', count: 1 }],
      NOW,
    );
    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({ date: '2026-09-04', users: 1, workspaces: 0 });
    expect(series[29]).toEqual({ date: '2026-10-03', users: 2, workspaces: 1 });
  });

  it('fills days without sign ups with zero and ignores days outside the window', () => {
    const series = signupSeries(
      [
        { date: '2026-09-03', count: 7 },
        { date: '2026-10-04', count: 7 },
      ],
      [],
      NOW,
    );
    expect(series.every((day) => day.users === 0 && day.workspaces === 0)).toBe(
      true,
    );
  });

  it('places the last millisecond of a utc day and the next midnight on different dates', () => {
    const lateNight = new Date('2026-10-02T23:59:59.999Z');
    const midnight = new Date('2026-10-03T00:00:00.000Z');
    expect(signupSeries([], [], lateNight).at(-1)?.date).toBe('2026-10-02');
    expect(signupSeries([], [], midnight).at(-1)?.date).toBe('2026-10-03');
  });
});

describe('signupWindowStart', () => {
  it('starts at midnight utc of the first day in the series', () => {
    const start = signupWindowStart(NOW);
    expect(start.toISOString()).toBe('2026-09-04T00:00:00.000Z');
    const earlySignup = new Date('2026-09-04T01:00:00.000Z');
    expect(earlySignup >= start).toBe(true);
    expect(signupSeries([], [], NOW)[0].date).toBe('2026-09-04');
  });
});

describe('tallyWorkspaces', () => {
  it('counts suspended and pending deletion independently', () => {
    const tally = tallyWorkspaces(
      [
        workspace({ suspendedAt: PAST, deletionDueAt: FUTURE }),
        workspace({ suspendedAt: PAST }),
        workspace({ deletionDueAt: FUTURE }),
        workspace(),
      ],
      false,
      NOW,
    );
    expect(tally.total).toBe(4);
    expect(tally.suspended).toBe(2);
    expect(tally.pendingDeletion).toBe(2);
  });

  it('buckets by the effective plan when billing is on', () => {
    const tally = tallyWorkspaces(
      [
        workspace({ plan: 'indie', planExpiresAt: FUTURE }),
        workspace({
          plan: 'ultimate',
          planExpiresAt: PAST,
          trialEndsAt: FUTURE,
        }),
        workspace({ plan: 'indie', planExpiresAt: PAST }),
        workspace({ trialEndsAt: PAST }),
      ],
      true,
      NOW,
    );
    expect(tally.byPlan.map((row) => row.key)).toEqual([...PLAN_NAMES]);
    expect(planCount(tally, 'indie')).toBe(1);
    expect(planCount(tally, 'trial')).toBe(1);
    expect(planCount(tally, 'free')).toBe(2);
    expect(planCount(tally, 'ultimate')).toBe(0);
  });

  it('puts every workspace under free when billing is off', () => {
    const tally = tallyWorkspaces(
      [
        workspace({ plan: 'indie', planExpiresAt: FUTURE }),
        workspace({ trialEndsAt: FUTURE }),
      ],
      false,
      NOW,
    );
    expect(planCount(tally, 'free')).toBe(2);
    expect(planCount(tally, 'indie')).toBe(0);
    expect(planCount(tally, 'trial')).toBe(0);
  });
});

describe('countsByKey', () => {
  it('lists every key in vocabulary order, zero filled, ignoring unknown keys', () => {
    expect(
      countsByKey(STORES, [
        { key: 'GOOGLE_PLAY', count: 2 },
        { key: 'GOOGLE_PLAY', count: 1 },
        { key: 'WINDOWS_STORE', count: 9 },
      ]),
    ).toEqual([
      { key: 'APP_STORE', count: 0 },
      { key: 'GOOGLE_PLAY', count: 3 },
    ]);
  });
});
