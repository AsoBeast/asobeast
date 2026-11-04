import { reviewSpike } from '../listing-events.fixture';
import {
  reviewSpikeFacts,
  reviewSpikeRow,
  reviewSpikeSentence,
  reviewSpikeTone,
} from './report-review-spike';

describe('review spike wording', () => {
  it('says how many reviews came against the usual day', () => {
    expect(reviewSpikeSentence(reviewSpike(), 'My App')).toBe(
      'A spike of 34 reviews for My App on 2 Nov 2026: median 4 a day, 71% at 2 stars or lower',
    );
    expect(
      reviewSpikeSentence(reviewSpike({ lowScoreMax: 1 }), 'My App'),
    ).toContain('71% at 1 star or lower');
  });

  it('lists the facts, the theme only when one stands out', () => {
    expect(reviewSpikeFacts(reviewSpike())).toEqual([
      { label: 'Day', value: '2 Nov 2026' },
      { label: 'Reviews', value: '34' },
      { label: 'Median per day', value: '4' },
      { label: 'Spike above', value: '12' },
      { label: 'Low reviews', value: '71% at 2 stars or lower' },
      { label: 'Top theme', value: '"crash on launch", 9 reviews, complaint' },
    ]);
    expect(
      reviewSpikeFacts(reviewSpike({ topTheme: null })).map(
        (fact) => fact.label,
      ),
    ).not.toContain('Top theme');
  });

  it('builds a text row with the theme as its detail', () => {
    expect(reviewSpikeRow(reviewSpike())).toEqual({
      kind: 'text',
      text: '2 Nov 2026 · 34 reviews, median 4 a day · 71% at 2 stars or lower',
      detail: 'Top theme: "crash on launch" (9 reviews)',
    });
    expect(reviewSpikeRow(reviewSpike({ topTheme: null })).detail).toBeNull();
  });

  it.each([
    [0.5, 'down'],
    [0.71, 'down'],
    [0.49, 'neutral'],
    [0, 'neutral'],
  ])('reads a low share of %p as %p', (lowShare, tone) => {
    expect(reviewSpikeTone([reviewSpike({ lowShare })])).toBe(tone);
  });
});
