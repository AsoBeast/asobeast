import { ActionItem, MetadataField } from '@asobeast/shared';
import {
  LintSnapshot,
  lintErrorCount,
  lintErrorPoints,
  snapshotLintField,
} from './action-lint-trend';

const DAY_MS = 86_400_000;
const TODAY = new Date('2026-07-30T00:00:00.000Z');
const day = (offset: number): Date =>
  new Date(TODAY.getTime() - offset * DAY_MS);

const snapshot = (overrides: Partial<LintSnapshot> = {}): LintSnapshot => ({
  capturedAt: TODAY,
  title: 'Budget Planner Money Tracker',
  subtitle: 'Expense log and savings goals',
  summary: 'Plan spending, log expenses and reach savings goals every month',
  description: 'Track every expense.',
  ...overrides,
});

const lintItem = (field: MetadataField | null): ActionItem =>
  ({
    rule: 'metadata.fix_lint',
    evidence:
      field === null
        ? null
        : {
            rule: 'metadata.fix_lint',
            field,
            chars: 34,
            limit: 30,
            issues: [],
          },
  }) as unknown as ActionItem;

describe('snapshotLintField', () => {
  it('answers the field a stored listing carries', () => {
    expect(snapshotLintField(lintItem('title'))).toBe('title');
    expect(snapshotLintField(lintItem('shortDescription'))).toBe(
      'shortDescription',
    );
  });

  it('answers nothing for the keyword field, which no listing stores', () => {
    expect(snapshotLintField(lintItem('keywordField'))).toBeNull();
  });

  it('answers nothing without the evidence that names the field', () => {
    expect(snapshotLintField(lintItem(null))).toBeNull();
  });
});

describe('lintErrorCount', () => {
  it('counts no problem on a listing within every rule', () => {
    for (const field of ['title', 'subtitle', 'description'] as const) {
      expect(lintErrorCount('APP_STORE', field, snapshot())).toBe(0);
    }
  });

  it('counts a title over its limit', () => {
    expect(
      lintErrorCount(
        'APP_STORE',
        'title',
        snapshot({ title: 'Budget Planner Money Tracker Pro' }),
      ),
    ).toBe(1);
  });

  it('counts each subtitle word the title already holds', () => {
    expect(
      lintErrorCount(
        'APP_STORE',
        'subtitle',
        snapshot({ subtitle: 'Money budget for families' }),
      ),
    ).toBe(2);
  });

  it('leaves warnings out of the count', () => {
    expect(
      lintErrorCount('APP_STORE', 'title', snapshot({ title: 'Budget™' })),
    ).toBe(0);
  });

  it('counts google play policy terms and emoji in the title', () => {
    expect(
      lintErrorCount(
        'GOOGLE_PLAY',
        'title',
        snapshot({ title: 'Best Budget Planner 💰' }),
      ),
    ).toBe(2);
  });

  it('reads a google play short description from the summary', () => {
    expect(
      lintErrorCount(
        'GOOGLE_PLAY',
        'shortDescription',
        snapshot({ summary: 'Download now, the best budget planner' }),
      ),
    ).toBe(2);
  });

  it('counts a missing short description as within every rule', () => {
    expect(
      lintErrorCount(
        'GOOGLE_PLAY',
        'shortDescription',
        snapshot({ summary: null }),
      ),
    ).toBe(0);
  });

  it('counts a description over its limit', () => {
    expect(
      lintErrorCount(
        'APP_STORE',
        'description',
        snapshot({ description: 'a'.repeat(4001) }),
      ),
    ).toBe(1);
  });

  it('answers nothing for a field the store does not have', () => {
    expect(lintErrorCount('GOOGLE_PLAY', 'subtitle', snapshot())).toBeNull();
  });
});

describe('lintErrorPoints', () => {
  it('draws one point per captured day from the last capture of that day', () => {
    const points = lintErrorPoints(
      'APP_STORE',
      'title',
      [
        snapshot({
          capturedAt: day(2),
          title: 'Budget Planner Money Tracker Pro',
        }),
        snapshot({ capturedAt: new Date(day(0).getTime() + 3_600_000) }),
        snapshot({
          capturedAt: day(0),
          title: 'Budget Planner Money Tracker Pro',
        }),
      ],
      { from: day(3), to: TODAY },
    );

    expect(points).toEqual([
      { date: '2026-07-27', checked: false, value: null },
      { date: '2026-07-28', checked: true, value: 1 },
      { date: '2026-07-29', checked: false, value: null },
      { date: '2026-07-30', checked: true, value: 0 },
    ]);
  });

  it('draws nothing checked for a field the store does not have', () => {
    const points = lintErrorPoints('GOOGLE_PLAY', 'subtitle', [snapshot()], {
      from: day(1),
      to: TODAY,
    });

    expect(points.every((point) => !point.checked)).toBe(true);
  });
});
