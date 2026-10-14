import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  canCompleteSetup,
  SETUP_KEYWORD_TARGET,
  SETUP_MARKETS_MAX,
  SETUP_STATUSES,
  SETUP_STEPS,
  setupProgress,
  setupSummary,
  stepState,
  type AppSetupState,
  type AppSetupSummary,
  type AppSetupUpdateRequest,
  type SetupCounts,
  type SetupStatus,
  type SetupStep,
} from '../index';

const counts = (
  competitors: number | null,
  keywords: number | null,
): SetupCounts => ({ competitors, keywords });

const started = (overrides: Partial<AppSetupState> = {}): AppSetupState => ({
  appId: 'app-1',
  status: 'in_progress',
  skipped: [],
  countriesReviewed: false,
  selectedMarkets: ['us'],
  completedAt: null,
  updatedAt: '2026-10-14T08:00:00.000Z',
  ...overrides,
});

const reviewed = (overrides: Partial<AppSetupState> = {}): AppSetupState =>
  started({ countriesReviewed: true, ...overrides });

describe('the setup vocabulary', () => {
  it('lists the steps in the order they are shown', () => {
    expect(SETUP_STEPS).toEqual(['competitors', 'keywords', 'countries']);
  });

  it('lists every status once, not started first', () => {
    expect(SETUP_STATUSES).toEqual([
      'not_started',
      'in_progress',
      'completed',
      'dismissed',
    ]);
  });

  it('selects at most fifty markets', () => {
    expect(SETUP_MARKETS_MAX).toBe(50);
  });

  it('types the record with the step and status unions', () => {
    expectTypeOf<AppSetupState['status']>().toEqualTypeOf<SetupStatus>();
    expectTypeOf<AppSetupState['skipped']>().toEqualTypeOf<SetupStep[]>();
    expectTypeOf<AppSetupUpdateRequest['status']>().toEqualTypeOf<
      SetupStatus | undefined
    >();
    expectTypeOf<AppSetupUpdateRequest['skipped']>().toEqualTypeOf<
      SetupStep[] | undefined
    >();
    expectTypeOf<AppSetupSummary['next']>().toEqualTypeOf<SetupStep | null>();
  });
});

describe('stepState', () => {
  it('waits for the count a step reads', () => {
    expect(stepState(started(), 'competitors', counts(null, 4))).toBe(
      'loading',
    );
    expect(stepState(started(), 'keywords', counts(1, null))).toBe('loading');
    expect(stepState(started(), 'countries', counts(null, null))).toBe('open');
  });

  it('finishes the competitor step at one competitor', () => {
    expect(stepState(started(), 'competitors', counts(0, 0))).toBe('open');
    expect(stepState(started(), 'competitors', counts(1, 0))).toBe('done');
  });

  it('finishes the keyword step at the keyword target', () => {
    expect(
      stepState(started(), 'keywords', counts(0, SETUP_KEYWORD_TARGET - 1)),
    ).toBe('open');
    expect(
      stepState(started(), 'keywords', counts(0, SETUP_KEYWORD_TARGET)),
    ).toBe('done');
  });

  it('finishes the countries step on review', () => {
    expect(stepState(reviewed(), 'countries', counts(0, 0))).toBe('done');
  });

  it('reports a skipped step as skipped until its target is reached', () => {
    const skipped = started({ skipped: ['competitors'] });

    expect(stepState(skipped, 'competitors', counts(null, 0))).toBe('skipped');
    expect(stepState(skipped, 'competitors', counts(0, 0))).toBe('skipped');
    expect(stepState(skipped, 'competitors', counts(1, 0))).toBe('done');
    expect(
      stepState(
        reviewed({ skipped: ['countries'] }),
        'countries',
        counts(0, 0),
      ),
    ).toBe('done');
    expect(stepState(started(), 'competitors', counts(0, 0))).toBe('open');
  });
});

describe('setupProgress', () => {
  it('counts done and skipped steps and names the first open one', () => {
    expect(setupProgress(started(), counts(1, 4))).toEqual({
      done: 1,
      total: 3,
      next: 'keywords',
    });
    expect(
      setupProgress(started({ skipped: ['keywords'] }), counts(1, 4)),
    ).toEqual({ done: 2, total: 3, next: 'countries' });
  });

  it('names a loading step as next', () => {
    expect(setupProgress(started(), counts(null, null)).next).toBe(
      'competitors',
    );
  });

  it('names no next step once every step is settled', () => {
    expect(setupProgress(reviewed(), counts(2, 12))).toEqual({
      done: 3,
      total: 3,
      next: null,
    });
  });
});

describe('canCompleteSetup', () => {
  const settled = (): AppSetupState =>
    reviewed({ skipped: ['competitors', 'keywords'] });

  it('completes once every step is done or skipped', () => {
    expect(canCompleteSetup(settled(), counts(0, 0))).toBe(true);
    expect(canCompleteSetup(reviewed(), counts(1, 10))).toBe(true);
  });

  it('blocks completion while a count is loading', () => {
    expect(canCompleteSetup(reviewed(), counts(null, 10))).toBe(false);
  });

  it('blocks completion while a step is open', () => {
    expect(canCompleteSetup(reviewed(), counts(1, 9))).toBe(false);
    expect(canCompleteSetup(started(), counts(1, 10))).toBe(false);
  });

  it('completes only a setup in progress', () => {
    expect(
      canCompleteSetup({ ...settled(), status: 'not_started' }, counts(1, 10)),
    ).toBe(false);
    expect(
      canCompleteSetup({ ...settled(), status: 'completed' }, counts(1, 10)),
    ).toBe(false);
  });

  it('blocks completion without a selected market', () => {
    expect(
      canCompleteSetup({ ...settled(), selectedMarkets: [] }, counts(1, 10)),
    ).toBe(false);
  });
});

describe('setupSummary', () => {
  it('carries the status beside the progress', () => {
    expect(setupSummary(started(), counts(1, 4))).toEqual({
      status: 'in_progress',
      updatedAt: '2026-10-14T08:00:00.000Z',
      done: 1,
      total: 3,
      next: 'keywords',
    });
  });
});
