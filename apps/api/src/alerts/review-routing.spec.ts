import type { AlertPayload } from '@asobeast/shared';
import { dropped, negative, newReview } from './email-fixtures.fixture';
import {
  receivesInstant,
  reviewGate,
  type Subscription,
} from './review-routing';

const NEW = 'review.new';
const NEGATIVE = 'review.negative';

const scored = <T extends typeof negative | typeof newReview>(
  payload: T,
  score: number,
): T => ({ ...payload, review: { ...payload.review, score } });

const subscription = (
  events: string[],
  reviewScores: number[] = [],
): Subscription => ({ events, reviewScores });

describe('receivesInstant', () => {
  it.each<[string, Subscription, AlertPayload, boolean]>([
    ['new, every star', subscription([NEW]), scored(newReview, 5), true],
    [
      'new, [1, 2], a 2',
      subscription([NEW], [1, 2]),
      scored(newReview, 2),
      true,
    ],
    [
      'new, [1, 2], a 5',
      subscription([NEW], [1, 2]),
      scored(newReview, 5),
      false,
    ],
    [
      'negative, a negative',
      subscription([NEGATIVE]),
      scored(negative, 1),
      true,
    ],
    [
      'negative, a new review',
      subscription([NEGATIVE]),
      scored(newReview, 1),
      false,
    ],
    [
      'both, every star, a negative',
      subscription([NEW, NEGATIVE]),
      scored(negative, 1),
      false,
    ],
    [
      'both, every star, a new 1',
      subscription([NEW, NEGATIVE]),
      scored(newReview, 1),
      true,
    ],
    [
      'both, [4, 5], a negative 1',
      subscription([NEW, NEGATIVE], [4, 5]),
      scored(negative, 1),
      true,
    ],
    [
      'both, [4, 5], a new 1',
      subscription([NEW, NEGATIVE], [4, 5]),
      scored(newReview, 1),
      false,
    ],
    [
      'both, [4, 5], a new 5',
      subscription([NEW, NEGATIVE], [4, 5]),
      scored(newReview, 5),
      true,
    ],
    ['rank, a rank drop', subscription(['rank.dropped'], [1]), dropped, true],
    [
      'rank, a new review',
      subscription(['rank.dropped']),
      scored(newReview, 5),
      false,
    ],
  ])('delivers to %s: %s', (_case, target, payload, delivered) => {
    expect(receivesInstant(target, payload)).toBe(delivered);
  });
});

describe('reviewGate', () => {
  const twin = (score: number, text: string) => {
    const body = { ...negative.review, score, text };
    return {
      fresh: { ...newReview, review: { ...body, author: 'Sam' } },
      negative: { ...negative, app: newReview.app, review: body },
    };
  };
  const one = twin(1, 'Crashes');
  const two = twin(2, 'Slow');
  const five = twin(5, 'Great');
  const alone = twin(1, 'Collected before the channel existed').negative;
  const batch = [
    one.fresh,
    one.negative,
    two.fresh,
    two.negative,
    five.fresh,
    alone,
    dropped,
  ];
  const kept = (allowed: string[], scores: number[] = []) =>
    batch.filter(reviewGate(batch, new Set(allowed), scores));

  it('keeps the new reviews whose stars the channel picked', () => {
    expect(kept([NEW], [1, 2])).toEqual([one.fresh, two.fresh]);
  });

  it('keeps every negative review and no new one for a negative channel', () => {
    expect(kept([NEGATIVE])).toEqual([one.negative, two.negative, alone]);
  });

  it('sends a review listed as new once and keeps a negative without a twin', () => {
    expect(kept([NEW, NEGATIVE])).toEqual([
      one.fresh,
      two.fresh,
      five.fresh,
      alone,
    ]);
  });

  it('keeps the negative reviews of the stars a channel left out', () => {
    expect(kept([NEW, NEGATIVE], [4, 5])).toEqual([
      one.negative,
      two.negative,
      five.fresh,
      alone,
    ]);
  });

  it('keeps an unrelated event only when the channel lists it', () => {
    expect(kept(['rank.dropped'])).toEqual([dropped]);
    expect(kept([NEW])).not.toContain(dropped);
  });
});
