import type { AlertPayload } from '@asobeast/shared';
import { dropped, negative, newReview } from './email-fixtures.fixture';
import { receivesInstant, type Subscription } from './review-routing';

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
