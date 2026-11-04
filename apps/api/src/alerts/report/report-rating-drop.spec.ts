import { ratingDropped } from '../listing-events.fixture';
import {
  ratingDropFacts,
  ratingDropRow,
  ratingDropSentence,
} from './report-rating-drop';

describe('rating drop wording', () => {
  it('says how far the average fell, where and over how many days', () => {
    expect(ratingDropSentence(ratingDropped(), 'My App', '🇺🇸 US')).toBe(
      "My App's average rating fell from 4.66 to 4.44 in 🇺🇸 US over 7 days",
    );
    expect(ratingDropSentence(ratingDropped(), 'My App', 'US')).toBe(
      "My App's average rating fell from 4.66 to 4.44 in US over 7 days",
    );
  });

  it('names the version that shipped in between', () => {
    expect(
      ratingDropSentence(ratingDropped({ version: '2.4' }), 'My App', 'US'),
    ).toBe(
      "My App's average rating fell from 4.66 to 4.44 in US over 7 days, since v2.4 shipped",
    );
  });

  it('counts the days between the two snapshots', () => {
    expect(
      ratingDropSentence(
        ratingDropped({ fromDate: '2026-10-26' }),
        'My App',
        'US',
      ),
    ).toContain('over 8 days');
  });

  it('lists the facts in order, the version only when known', () => {
    expect(ratingDropFacts(ratingDropped(), 'US')).toEqual([
      { label: 'Market', value: 'US' },
      { label: 'Rating', value: '4.66 → 4.44' },
      { label: 'Drop', value: '2 tenths' },
      { label: 'Ratings', value: '1,200 → 1,260' },
      { label: 'Period', value: '27 Oct to 3 Nov 2026' },
    ]);
    expect(
      ratingDropFacts(ratingDropped({ dropTenths: 1, version: '2.4' }), 'US'),
    ).toEqual(
      expect.arrayContaining([
        { label: 'Drop', value: '1 tenth' },
        { label: 'Version', value: 'v2.4' },
      ]),
    );
  });

  it('builds a move row with the drop and the version', () => {
    expect(ratingDropRow(ratingDropped())).toEqual({
      kind: 'move',
      label: 'Average rating',
      from: '4.66',
      to: '4.44',
      note: 'down 2 tenths',
    });
    expect(ratingDropRow(ratingDropped({ version: '2.4' })).note).toBe(
      'down 2 tenths · v2.4',
    );
  });
});

describe('rating drop version label', () => {
  it('never doubles the v of a version that carries one', () => {
    expect(ratingDropRow(ratingDropped({ version: 'v2.4' })).note).toBe(
      'down 2 tenths · v2.4',
    );
  });
});
