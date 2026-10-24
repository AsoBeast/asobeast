import { ACTION_RULE_TITLES, RANK_DEPTH } from '@asobeast/shared';
import {
  actionOpened,
  dropped,
  droppedOut,
  everyFieldChanged,
  improved,
  metadata,
  negative,
} from '../email-fixtures.fixture';
import { firstRanking, milestone, overtake } from '../rank-events.fixture';
import {
  actionRow,
  changeRows,
  clip,
  entrantRows,
  firstRankingRow,
  keywordCell,
  milestoneRow,
  overtakeRow,
  rankCell,
  rankRow,
  reviewRow,
} from './report-rows';
import type { ReportRow } from './report';

const textOf = (row: ReportRow): string | null =>
  row.kind === 'text' ? row.text : null;

const fieldOf = (row: ReportRow): string | null =>
  row.kind === 'change' || row.kind === 'image' ? row.field : null;

describe('rankCell', () => {
  it('prints a rank with a hash and an unranked check against its depth', () => {
    expect(rankCell(24, RANK_DEPTH)).toBe('#24');
    expect(rankCell(null, 100)).toBe('>100');
  });
});

describe('keywordCell', () => {
  it('drops the market of a keyword tracked in the app storefront', () => {
    expect(keywordCell({ text: 'memes', country: 'us' }, 'US')).toBe('memes');
  });

  it('keeps the market of a keyword tracked elsewhere', () => {
    expect(keywordCell({ text: 'geoguessr', country: 'pl' }, 'us')).toBe(
      'geoguessr (PL)',
    );
    expect(keywordCell({ text: 'geoguessr', country: 'pl' }, null)).toBe(
      'geoguessr (PL)',
    );
  });

  it('prints a keyword an older payload sent without a market', () => {
    expect(keywordCell({ text: 'game' }, 'us')).toBe('game');
  });
});

describe('clip', () => {
  it('cuts a long value at 80 characters with one ellipsis', () => {
    const clipped = clip('x'.repeat(200));

    expect([...clipped]).toHaveLength(80);
    expect(clipped.endsWith('x…')).toBe(true);
  });

  it('counts a character outside the basic plane once', () => {
    expect(clip('𠮷'.repeat(80))).toBe('𠮷'.repeat(80));
  });

  it('puts multi line release notes on one line', () => {
    expect(clip('v2.8\n- New stickers\n- Faster sync')).toBe(
      'v2.8 - New stickers - Faster sync',
    );
  });

  it('prints a missing value as a dash', () => {
    expect(clip(null)).toBe('—');
  });
});

describe('rank rows', () => {
  it('moves a drop between two ranks', () => {
    expect(rankRow(dropped, 'us')).toEqual({
      kind: 'move',
      label: 'fitness app',
      from: '#4',
      to: '#12',
      note: null,
    });
  });

  it('prints a drop out against its depth', () => {
    expect(rankRow(droppedOut, 'us')).toMatchObject({ from: '#3', to: '>100' });
  });

  it('keeps the market of an improvement in another storefront', () => {
    expect(rankRow(improved, 'us')).toMatchObject({
      label: 'habit tracker (DE)',
    });
  });

  it('notes the milestone a move crossed', () => {
    expect(milestoneRow(milestone(), 'us')).toEqual({
      kind: 'move',
      label: 'habit tracker',
      from: '#14',
      to: '#8',
      note: 'entered the top 10',
    });
    expect(
      milestoneRow(milestone({ tier: 1, direction: 'left' }), 'us'),
    ).toMatchObject({ note: 'lost first place' });
  });

  it('prints a first ranking and an overtake', () => {
    expect(firstRankingRow(firstRanking(), 'us')).toEqual({
      kind: 'text',
      text: 'habit tracker  #37',
      detail: null,
    });
    expect(overtakeRow(overtake(), 'us')).toMatchObject({
      text: 'habit tracker · Rival Focus #9 → #4, you #5 → #6',
    });
  });

  it('names an overtaking competitor without a name', () => {
    expect(
      overtakeRow(
        overtake({
          competitor: { id: 'r', name: null, from: null, to: 4 },
        }),
        'us',
      ),
    ).toMatchObject({
      text: 'habit tracker · A competitor >200 → #4, you #5 → #6',
    });
  });
});

describe('entrantRows', () => {
  it('prints one row per entrant with its keyword first', () => {
    expect(
      entrantRows(
        {
          event: 'serp.entrant',
          occurredAt: dropped.occurredAt,
          keyword: dropped.keyword,
          date: '2026-10-24',
          entrants: [
            {
              position: 3,
              storeAppId: 's1',
              title: 'CloneAI',
              appId: null,
              isCompetitor: false,
            },
            {
              position: 5,
              storeAppId: 's2',
              title: 'Rival',
              appId: 'r',
              isCompetitor: true,
            },
          ],
        },
        'us',
      ).map(textOf),
    ).toEqual([
      'fitness app · #3 CloneAI',
      'fitness app · #5 Rival (competitor)',
    ]);
  });
});

describe('changeRows', () => {
  it('shows an icon change as images, never as urls', () => {
    expect(changeRows(metadata)).toEqual([
      { kind: 'change', field: 'Title', before: '"A"', after: '"B"' },
      { kind: 'image', field: 'Icon changed', beforeUrl: null, afterUrl: 'y' },
    ]);
  });

  it('names every field the way the store consoles do', () => {
    const rows = changeRows(everyFieldChanged);

    expect(rows.map(fieldOf)).toEqual([
      'Title',
      'Subtitle',
      'Short description',
      'Description',
      'Version',
      'Price',
      'Screenshots',
      null,
      'Screenshot captions',
      'Icon changed',
      "What's new",
    ]);
    expect(rows[7]).toEqual({
      kind: 'text',
      text: 'Screenshots replaced or reordered',
      detail: null,
    });
  });

  it('quotes text fields and leaves counts and prices bare', () => {
    expect(
      changeRows({
        ...metadata,
        changes: [
          { field: 'screenshots', before: '8', after: '10' },
          { field: 'price', before: '0', after: '2.99' },
          {
            field: 'whatsNew',
            before: 'Bug fixes and speed improvements.',
            after: null,
          },
        ],
      }),
    ).toEqual([
      { kind: 'change', field: 'Screenshots', before: '8', after: '10' },
      { kind: 'change', field: 'Price', before: '0', after: '2.99' },
      {
        kind: 'change',
        field: "What's new",
        before: '"Bug fixes and speed improvements."',
        after: '—',
      },
    ]);
  });
});

describe('reviewRow', () => {
  it('prints the stars, the quote and the version', () => {
    expect(reviewRow(negative)).toMatchObject({
      text: '★☆☆☆☆ "Crashes on <launch>" · v2.0.0',
    });
  });

  it('names a rating only review and leaves out a missing version', () => {
    expect(
      reviewRow({
        ...negative,
        review: { ...negative.review, text: '  ', version: null },
      }),
    ).toMatchObject({ text: '★☆☆☆☆ no written review' });
  });
});

describe('actionRow', () => {
  it('prints the priority, the rule title and the impact over its scope', () => {
    const row = actionRow(actionOpened);

    expect(textOf(row)).toBe(
      `High · ${ACTION_RULE_TITLES['keyword.add_uncovered']} · impact 71`,
    );
    expect(row.kind === 'text' && row.detail).toMatch(
      /^US · App Store · opportunity 66.5/,
    );
  });

  it('says when an action reopened', () => {
    expect(
      actionRow({
        ...actionOpened,
        action: {
          ...actionOpened.action,
          priority: 'critical',
          reopened: true,
        },
      }),
    ).toMatchObject({
      text: `Critical · ${ACTION_RULE_TITLES['keyword.add_uncovered']} · impact 71 · reopened`,
    });
  });
});
