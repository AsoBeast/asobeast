import {
  RepliedAtRef,
  replyStateWhere,
  reviewOrder,
  reviewScopeWhere,
  reviewsWhere,
} from './review-list-query';

const repliedAt: RepliedAtRef = {
  modelName: 'Review',
  name: 'repliedAt',
  typeName: 'DateTime',
  isList: false,
};

describe('replyStateWhere', () => {
  it('answers updated as a review edited after the reply the store shows', () => {
    expect(replyStateWhere('updated', repliedAt)).toEqual({
      repliedAt: { not: null },
      reviewedAt: { gt: repliedAt },
    });
  });

  it("answers replied as the store's reply on an unedited review or the owner's mark", () => {
    expect(replyStateWhere('replied', repliedAt)).toEqual({
      OR: [
        {
          repliedAt: { not: null },
          OR: [{ reviewedAt: null }, { reviewedAt: { lte: repliedAt } }],
        },
        { repliedAt: null, reply: { is: { repliedAt: { not: null } } } },
      ],
    });
  });

  it('answers drafted as a reply without a mark on a review the store shows no reply on', () => {
    expect(replyStateWhere('drafted', repliedAt)).toEqual({
      repliedAt: null,
      reply: { is: { repliedAt: null } },
    });
  });

  it('answers needs reply as no reply anywhere', () => {
    expect(replyStateWhere('needs_reply', repliedAt)).toEqual({
      repliedAt: null,
      reply: { is: null },
    });
  });

  it('answers nothing for no state', () => {
    expect(replyStateWhere(undefined, repliedAt)).toEqual({});
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

describe('reviewsWhere', () => {
  it('keeps the period and the updated state apart, though both read reviewedAt', () => {
    const from = new Date('2026-09-06T00:00:00Z');

    expect(reviewsWhere('app1', { from }, 'updated', repliedAt)).toEqual({
      AND: [
        { appId: 'app1', reviewedAt: { gte: from } },
        { repliedAt: { not: null }, reviewedAt: { gt: repliedAt } },
      ],
    });
  });
});
