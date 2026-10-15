import { describe, expect, it } from 'vitest';

import {
  replyStateOf,
  REVIEW_REPLY_LIMITS,
  REVIEW_REPLY_MAX_CHARS,
  REVIEW_REPLY_STATES,
  REVIEW_REPLY_TONES,
  REVIEW_SORTS,
  type ReviewReplyItem,
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
    expect(REVIEW_REPLY_STATES).toEqual(['needs_reply', 'drafted', 'replied']);
    expect(REVIEW_SORTS).toEqual(['newest', 'lowest']);
  });
});
