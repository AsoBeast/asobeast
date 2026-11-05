import type { AlertPayload } from '@asobeast/shared';
import { negative } from './email-fixtures.fixture';
import {
  drop,
  firstRanking,
  improvement,
  milestone,
} from './rank-events.fixture';
import {
  reachesRankThreshold,
  subscriptionThreshold,
  withThreshold,
} from './rank-threshold';

describe('reachesRankThreshold', () => {
  it.each<[string, AlertPayload, number, boolean]>([
    ['a drop of ten', drop({ from: 4, to: 14 }), 10, true],
    ['a drop of nine', drop({ from: 4, to: 13 }), 10, false],
    ['a drop out of the depth', drop({ from: 4, to: null }), 200, true],
    ['a climb of ten', improvement({ from: 30, to: 20 }), 10, true],
    ['a first ranking back', improvement({ from: null, to: 8 }), 50, true],
    ['a climb of three', improvement({ from: 12, to: 9 }), 5, false],
    ['a milestone', milestone(), 200, true],
    ['a first ranking', firstRanking(), 200, true],
    ['a negative review', negative, 200, true],
  ])('judges %s', (_name, payload, threshold, reaches) => {
    expect(reachesRankThreshold(payload, threshold)).toBe(reaches);
  });
});

describe('withThreshold', () => {
  it('names the threshold of the subscription on a rank move only', () => {
    expect(withThreshold(drop(), 10)).toMatchObject({ threshold: 10 });
    expect(withThreshold(improvement(), 7)).toMatchObject({ threshold: 7 });
    const other = milestone();
    expect(withThreshold(other, 10)).toBe(other);
  });
});

describe('subscriptionThreshold', () => {
  it.each([
    [null, 5, 5],
    [undefined, 5, 5],
    [10, 5, 10],
    [3, 5, 5],
  ])('answers %p on an instance at %p as %p', (own, instance, expected) => {
    expect(subscriptionThreshold({ rankDropThreshold: own }, instance)).toBe(
      expected,
    );
  });
});
