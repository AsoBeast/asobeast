import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  isPostEdited,
  replyStateOf,
  REVIEW_POST_STATES,
  REVIEW_REPLY_LIMITS,
  REVIEW_REPLY_MAX_CHARS,
  REVIEW_REPLY_STATES,
  REVIEW_REPLY_TONES,
  REVIEW_SORTS,
  REVIEW_THEMES_BASELINE,
  type ReviewReplyItem,
  type ReviewReplyPost,
} from '../index';

const REPLY: ReviewReplyItem = {
  text: 'Thanks for the report',
  tone: null,
  model: null,
  generatedAt: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
  repliedAt: null,
};

describe('replyStateOf', () => {
  it('answers replied for a review google play shows a reply on', () => {
    expect(
      replyStateOf({ repliedAt: '2026-09-02T08:00:00.000Z', reply: null }),
    ).toBe('replied');
  });

  it('answers updated for a review edited after google play showed the reply', () => {
    expect(
      replyStateOf({
        reviewedAt: '2026-09-05T08:00:00.000Z',
        repliedAt: '2026-09-02T08:00:00.000Z',
        reply: null,
      }),
    ).toBe('updated');
  });

  it('answers replied for a review the reply came after or that has no date', () => {
    const repliedAt = '2026-09-02T08:00:00.000Z';

    expect(
      replyStateOf({ reviewedAt: '2026-09-01T08:00:00.000Z', repliedAt }),
    ).toBe('replied');
    expect(replyStateOf({ reviewedAt: repliedAt, repliedAt })).toBe('replied');
    expect(replyStateOf({ reviewedAt: null, repliedAt })).toBe('replied');
  });

  it('keeps a marked review replied whatever its date', () => {
    expect(
      replyStateOf({
        reviewedAt: '2026-10-05T00:00:00.000Z',
        repliedAt: null,
        reply: { ...REPLY, repliedAt: '2026-10-01T00:00:00.000Z' },
      }),
    ).toBe('replied');
  });

  it('answers replied for a review the owner marked', () => {
    expect(
      replyStateOf({
        repliedAt: null,
        reply: { ...REPLY, repliedAt: '2026-10-01T00:00:00.000Z' },
      }),
    ).toBe('replied');
  });

  it('answers drafted for a reply that is not marked', () => {
    expect(
      replyStateOf({ repliedAt: null, reply: { ...REPLY, repliedAt: null } }),
    ).toBe('drafted');
  });

  it('answers needs reply with no reply at all', () => {
    expect(replyStateOf({ repliedAt: null, reply: null })).toBe('needs_reply');
    expect(replyStateOf({})).toBe('needs_reply');
  });
});

const POST: ReviewReplyPost = {
  postedAt: '2026-10-02T00:00:00.000Z',
  postedText: 'Thanks!',
  state: 'published',
  storeResponseId: null,
  postedBy: 'owner@example.com',
};

describe('the posted reply', () => {
  it('keeps the reply item compatible and adds an optional post', () => {
    expectTypeOf<ReviewReplyItem['post']>().toEqualTypeOf<
      ReviewReplyPost | null | undefined
    >();
  });

  it('names the two post states', () => {
    expect(REVIEW_POST_STATES).toEqual(['pending', 'published']);
  });

  it('says a reply is edited when its text differs from the posted text', () => {
    expect(isPostEdited({ text: 'Thanks!', post: POST })).toBe(false);
    expect(isPostEdited({ text: 'Thanks! ', post: POST })).toBe(false);
    expect(isPostEdited({ text: 'Thank you', post: POST })).toBe(true);
    expect(isPostEdited({ text: 'Thank you', post: null })).toBe(false);
    expect(isPostEdited({ text: 'Thank you' })).toBe(false);
  });

  it('keeps replyStateOf unchanged by a post', () => {
    expect(
      replyStateOf({
        repliedAt: POST.postedAt,
        reply: { ...REPLY, repliedAt: POST.postedAt, post: POST },
      }),
    ).toBe('replied');
  });
});

describe('review reply constants', () => {
  it("keeps the google play limit at the store's 350 and the app store ceiling above it", () => {
    expect(REVIEW_REPLY_LIMITS.GOOGLE_PLAY).toBe(350);
    expect(REVIEW_REPLY_LIMITS.APP_STORE).toBe(2000);
    expect(REVIEW_REPLY_MAX_CHARS).toBe(
      Math.max(REVIEW_REPLY_LIMITS.GOOGLE_PLAY, REVIEW_REPLY_LIMITS.APP_STORE),
    );
  });

  it('lists the tones, states and sorts the api accepts', () => {
    expect(REVIEW_REPLY_TONES).toEqual(['friendly', 'neutral', 'formal']);
    expect(REVIEW_REPLY_STATES).toEqual([
      'needs_reply',
      'drafted',
      'replied',
      'updated',
    ]);
    expect(REVIEW_SORTS).toEqual(['newest', 'lowest']);
  });
});

describe('REVIEW_THEMES_BASELINE', () => {
  it('compares a theme with the newest 500 reviews of the period', () => {
    expect(REVIEW_THEMES_BASELINE).toBe(500);
  });
});
