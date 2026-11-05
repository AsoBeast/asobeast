import { Store } from '@prisma/client';
import { discoverKeywordJobId } from '../jobs/jobs.types';
import {
  isDue,
  remainingChecks,
  ScheduledRow,
  selectChecks,
  weekStartOf,
} from './discovery-schedule';

const TODAY = '2026-11-12';

const row = (overrides: Partial<ScheduledRow> = {}): ScheduledRow => ({
  keywordId: 'k1',
  text: 'habit',
  country: 'us',
  relevance: 60,
  position: null,
  depth: null,
  checkedOn: null,
  dismissed: false,
  ...overrides,
});

describe('weekStartOf', () => {
  it('answers the Monday of the ISO week at midnight UTC', () => {
    expect(weekStartOf(new Date('2026-11-09T07:30:00Z'))).toEqual(
      new Date('2026-11-09T00:00:00Z'),
    );
  });

  it('keeps a Sunday in the week that began the Monday before', () => {
    expect(weekStartOf(new Date('2026-11-15T23:59:59Z'))).toEqual(
      new Date('2026-11-09T00:00:00Z'),
    );
  });

  it('crosses a year boundary', () => {
    expect(weekStartOf(new Date('2027-01-01T12:00:00Z'))).toEqual(
      new Date('2026-12-28T00:00:00Z'),
    );
  });
});

describe('isDue', () => {
  it('is due when never checked', () => {
    expect(isDue(row(), TODAY)).toBe(true);
  });

  it('is due while a capture missed the app and the deep search is missing', () => {
    expect(isDue(row({ depth: 50, checkedOn: TODAY }), TODAY)).toBe(true);
  });

  it('waits a week after a deep search that found nothing', () => {
    expect(isDue(row({ depth: 200, checkedOn: '2026-11-09' }), TODAY)).toBe(
      false,
    );
    expect(isDue(row({ depth: 200, checkedOn: '2026-11-05' }), TODAY)).toBe(
      true,
    );
  });

  it('waits a week after a position was found', () => {
    expect(
      isDue(row({ position: 4, depth: 50, checkedOn: '2026-11-10' }), TODAY),
    ).toBe(false);
    expect(
      isDue(row({ position: 4, depth: 200, checkedOn: '2026-11-04' }), TODAY),
    ).toBe(true);
  });

  it('is never due once dismissed', () => {
    expect(isDue(row({ dismissed: true }), TODAY)).toBe(false);
  });
});

describe('selectChecks', () => {
  it('orders never checked first, then the oldest check, then relevance and text', () => {
    const rows = [
      row({ keywordId: 'old', depth: 200, checkedOn: '2026-10-01' }),
      row({ keywordId: 'older', depth: 200, checkedOn: '2026-09-01' }),
      row({ keywordId: 'fresh', depth: 200, checkedOn: TODAY }),
      row({ keywordId: 'b', text: 'b' }),
      row({ keywordId: 'a', text: 'a' }),
      row({ keywordId: 'top', text: 'z', relevance: 90 }),
    ];
    expect(
      selectChecks(rows, 10, TODAY).map(({ keywordId }) => keywordId),
    ).toEqual(['top', 'a', 'b', 'older', 'old']);
  });

  it('selects at most the remaining checks', () => {
    const rows = [row({ keywordId: 'a' }), row({ keywordId: 'b' })];
    expect(selectChecks(rows, 1, TODAY)).toHaveLength(1);
  });

  it.each([0, -3])('selects nothing with %i remaining', (remaining) => {
    expect(selectChecks([row()], remaining, TODAY)).toEqual([]);
  });
});

describe('remainingChecks', () => {
  it('subtracts the used checks from the weekly cap of the store', () => {
    expect(remainingChecks(Store.APP_STORE, 15)).toBe(25);
    expect(remainingChecks(Store.GOOGLE_PLAY, 5)).toBe(15);
  });

  it('never answers below zero', () => {
    expect(remainingChecks(Store.GOOGLE_PLAY, 30)).toBe(0);
  });
});

describe('discoverKeywordJobId', () => {
  it('is stable and carries no colon', () => {
    const id = discoverKeywordJobId('app-1', 'kw-1', '2026-W46');
    expect(id).toBe('discover~app-1~kw-1~2026-W46');
    expect(id).not.toContain(':');
    expect(discoverKeywordJobId('app-1', 'kw-1', '2026-W46')).toBe(id);
  });
});
