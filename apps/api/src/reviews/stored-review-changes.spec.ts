import { ReviewResult } from '../store-providers/types';
import { TRANSLATION_CLEARED } from './review-translation';
import { StoredReview, storedReviewChanges } from './stored-review-changes';

const STORED: StoredReview = {
  score: 2,
  title: 'Crashes',
  text: 'Crashes on start',
  version: '2.0.0',
  reviewedAt: new Date('2026-09-01T08:00:00Z'),
  repliedAt: new Date('2026-09-02T08:00:00Z'),
  replyText: 'Fixed in 2.0.1',
};

const fetched = (over: Partial<ReviewResult> = {}): ReviewResult => ({
  reviewId: 'r1',
  score: STORED.score,
  title: STORED.title ?? undefined,
  text: STORED.text,
  version: STORED.version ?? undefined,
  updatedAt: STORED.reviewedAt ?? undefined,
  repliedAt: STORED.repliedAt ?? undefined,
  replyText: STORED.replyText ?? undefined,
  ...over,
});

describe('storedReviewChanges', () => {
  it('changes nothing for a review the store answers unchanged or not at all', () => {
    expect(storedReviewChanges(STORED, fetched())).toEqual({});
    expect(storedReviewChanges(STORED, undefined)).toEqual({});
  });

  it('takes the edited score, text and date of a review the reviewer changed', () => {
    const edited = new Date('2026-09-05T08:00:00Z');

    expect(
      storedReviewChanges(
        STORED,
        fetched({
          score: 5,
          title: undefined,
          text: 'Works now, thanks',
          version: '2.0.1',
          updatedAt: edited,
        }),
      ),
    ).toEqual({
      score: 5,
      title: null,
      text: 'Works now, thanks',
      version: '2.0.1',
      reviewedAt: edited,
      ...TRANSLATION_CLEARED,
    });
  });

  it('keeps the translation when only the score of an edited review changed', () => {
    const changes = storedReviewChanges(
      STORED,
      fetched({ score: 4, updatedAt: new Date('2026-09-05T08:00:00Z') }),
    );

    expect(changes).toMatchObject({ score: 4 });
    expect(changes).not.toHaveProperty('translatedText');
  });

  it('keeps the stored version when the edited review names none', () => {
    const changes = storedReviewChanges(
      STORED,
      fetched({
        version: undefined,
        updatedAt: new Date('2026-09-05T08:00:00Z'),
      }),
    );

    expect(changes.version).toBe('2.0.0');
  });

  it('ignores an older or undated store answer', () => {
    expect(
      storedReviewChanges(
        STORED,
        fetched({ text: 'Old', updatedAt: new Date('2026-08-01T00:00:00Z') }),
      ),
    ).toEqual({});
    expect(
      storedReviewChanges(
        { ...STORED, reviewedAt: null },
        fetched({ text: 'Undated' }),
      ),
    ).toEqual({});
  });

  it('records a reply the developer posted or edited later', () => {
    const later = new Date('2026-09-06T08:00:00Z');

    expect(
      storedReviewChanges(
        STORED,
        fetched({ repliedAt: later, replyText: 'Fixed in 2.0.2' }),
      ),
    ).toEqual({ repliedAt: later, replyText: 'Fixed in 2.0.2' });
    expect(
      storedReviewChanges(
        { ...STORED, repliedAt: null, replyText: null },
        fetched(),
      ),
    ).toEqual({ repliedAt: STORED.repliedAt, replyText: STORED.replyText });
  });
});
