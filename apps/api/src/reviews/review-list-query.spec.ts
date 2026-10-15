import {
  replyStateWhere,
  reviewOrder,
  reviewScopeWhere,
} from './review-list-query';

describe('replyStateWhere', () => {
  it("answers the replied rows as the store's reply or the owner's mark", () => {
    expect(replyStateWhere('replied')).toEqual({
      OR: [
        { repliedAt: { not: null } },
        { reply: { is: { repliedAt: { not: null } } } },
      ],
    });
  });

  it('answers drafted as a reply without a mark on a review the store shows no reply on', () => {
    expect(replyStateWhere('drafted')).toEqual({
      repliedAt: null,
      reply: { is: { repliedAt: null } },
    });
  });

  it('answers needs reply as no reply anywhere', () => {
    expect(replyStateWhere('needs_reply')).toEqual({
      repliedAt: null,
      reply: { is: null },
    });
  });

  it('answers nothing for no state', () => {
    expect(replyStateWhere(undefined)).toEqual({});
  });
});

describe('reviewOrder', () => {
  it('orders newest first by default and lowest score first on request', () => {
    expect(reviewOrder('newest')).toEqual([
      { reviewedAt: { sort: 'desc', nulls: 'last' } },
      { id: 'desc' },
    ]);
    expect(reviewOrder('lowest')).toEqual([
      { score: 'asc' },
      { reviewedAt: { sort: 'desc', nulls: 'last' } },
      { id: 'desc' },
    ]);
  });
});

describe('reviewScopeWhere', () => {
  it('scopes to the app alone without filters', () => {
    expect(reviewScopeWhere('app1', {})).toEqual({ appId: 'app1' });
  });

  it('adds the star, the version and the first day', () => {
    const from = new Date('2026-09-15T00:00:00Z');

    expect(
      reviewScopeWhere('app1', { score: 1, version: '2.0.0', from }),
    ).toEqual({
      appId: 'app1',
      score: 1,
      version: '2.0.0',
      reviewedAt: { gte: from },
    });
  });
});
