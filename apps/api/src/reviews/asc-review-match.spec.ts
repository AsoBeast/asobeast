import type { AscCustomerReview } from '../store-connect/asc-reviews-api';
import { matchCustomerReview, type StoredReview } from './asc-review-match';

const REVIEW: StoredReview = {
  userName: 'sleepless',
  score: 1,
  title: 'Crashes on launch',
  text: 'Every time I open it the app closes.',
  reviewedAt: new Date('2026-09-05T15:12:00.000Z'),
};

const candidate = (
  id: string,
  overrides: Partial<AscCustomerReview> = {},
): AscCustomerReview => ({
  id,
  rating: 1,
  title: 'Crashes on launch',
  body: 'Every time I open it the app closes.',
  reviewerNickname: 'sleepless',
  createdDate: '2026-09-05T08:12:00-07:00',
  territory: 'USA',
  ...overrides,
});

describe('matchCustomerReview', () => {
  it('matches on nickname, rating, title and body after trimming', () => {
    const match = candidate('asc-1', {
      title: '  Crashes on launch ',
      body: '\nEvery time I open it the app closes.  ',
      reviewerNickname: ' sleepless',
    });

    expect(
      matchCustomerReview(REVIEW, [
        candidate('asc-0', { rating: 2 }),
        candidate('asc-2', { reviewerNickname: 'someone' }),
        match,
      ]),
    ).toBe(match);
  });

  it('prefers a dated candidate over any number without a readable date', () => {
    expect(
      matchCustomerReview(REVIEW, [
        candidate('asc-undated-1', { createdDate: '' }),
        candidate('asc-undated-2', { createdDate: 'soon' }),
        candidate('asc-dated', { createdDate: '2026-09-01T00:00:00Z' }),
        candidate('asc-undated-3', { createdDate: '' }),
      ]),
    ).toMatchObject({ id: 'asc-dated' });
  });

  it('refuses to choose between two candidates it cannot tell apart', () => {
    const undated = { ...REVIEW, reviewedAt: null };

    expect(
      matchCustomerReview(undated, [candidate('asc-1'), candidate('asc-2')]),
    ).toBeNull();
    expect(
      matchCustomerReview(REVIEW, [
        candidate('asc-1', { createdDate: '2026-09-05T15:12:00Z' }),
        candidate('asc-2', { createdDate: '2026-09-05T15:12:00Z' }),
      ]),
    ).toBeNull();
  });

  it('ignores a candidate whose body differs by one character', () => {
    expect(
      matchCustomerReview(REVIEW, [
        candidate('asc-1', { body: 'Every time I open it the app closes!' }),
      ]),
    ).toBeNull();
  });

  it('treats a missing title on both sides as equal and a title on one side as different', () => {
    const untitled = { ...REVIEW, title: null };

    expect(
      matchCustomerReview(untitled, [candidate('asc-1', { title: null })]),
    ).toMatchObject({ id: 'asc-1' });
    expect(
      matchCustomerReview({ ...REVIEW, title: '  ' }, [
        candidate('asc-1', { title: null }),
      ]),
    ).toMatchObject({ id: 'asc-1' });
    expect(matchCustomerReview(untitled, [candidate('asc-1')])).toBeNull();
    expect(
      matchCustomerReview(REVIEW, [candidate('asc-1', { title: null })]),
    ).toBeNull();
  });

  it('picks the candidate nearest the review date among several matches', () => {
    const weekAway = candidate('asc-week', {
      createdDate: '2026-09-12T08:12:00-07:00',
    });
    const dayAway = candidate('asc-day', {
      createdDate: '2026-09-04T08:12:00-07:00',
    });

    expect(matchCustomerReview(REVIEW, [weekAway, dayAway])).toBe(dayAway);
  });

  it('refuses several equal matches for a review without a date', () => {
    expect(
      matchCustomerReview({ ...REVIEW, reviewedAt: null }, [
        candidate('asc-new'),
        candidate('asc-old', { createdDate: '2026-08-01T00:00:00Z' }),
      ]),
    ).toBeNull();
  });

  it('matches without a nickname when the stored review has none', () => {
    const anonymous = { ...REVIEW, userName: null };
    const named = candidate('asc-named');
    const unnamed = candidate('asc-unnamed', {
      reviewerNickname: null,
      createdDate: '2026-09-12T08:12:00-07:00',
    });

    expect(matchCustomerReview(anonymous, [named])).toBe(named);
    expect(matchCustomerReview(anonymous, [named, unnamed])).toBe(unnamed);
  });

  it('answers null without a match', () => {
    expect(matchCustomerReview(REVIEW, [])).toBeNull();
    expect(
      matchCustomerReview(REVIEW, [candidate('asc-1', { rating: 5 })]),
    ).toBeNull();
  });
});
