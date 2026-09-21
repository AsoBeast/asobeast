import { parseReviewsFeed, reviewsFeedUrl } from './app-store-reviews-feed';

function entry(id: string, rating?: unknown): Record<string, unknown> {
  return {
    author: {
      uri: { label: `https://itunes.apple.com/us/reviews/id${id}` },
      name: { label: 'Rishabh92838' },
      label: '',
    },
    updated: { label: '2026-09-17T18:39:31-07:00' },
    ...(rating === undefined ? {} : { 'im:rating': { label: rating } }),
    'im:version': { label: '9.1.572' },
    id: { label: id },
    title: { label: 'No help' },
    content: { label: 'Worst support', attributes: { type: 'text' } },
    'im:voteSum': { label: '0' },
    'im:voteCount': { label: '0' },
  };
}

function feedOf(entries?: unknown): unknown {
  return {
    feed: {
      author: { name: { label: 'iTunes Store' } },
      ...(entries === undefined ? {} : { entry: entries }),
    },
  };
}

describe('reviewsFeedUrl', () => {
  it('requests the most recent reviews as json past the edge cache', () => {
    expect(reviewsFeedUrl(288429040, 'us', 2, 'abc')).toBe(
      'https://itunes.apple.com/us/rss/customerreviews/page=2/id=288429040/sortby=mostrecent/json?nonce=abc',
    );
  });
});

describe('parseReviewsFeed', () => {
  it('maps every review entry', () => {
    expect(parseReviewsFeed(feedOf([entry('14562526759', '1')]))).toEqual([
      {
        id: '14562526759',
        userName: 'Rishabh92838',
        version: '9.1.572',
        score: 1,
        title: 'No help',
        text: 'Worst support',
        updated: '2026-09-17T18:39:31-07:00',
      },
    ]);
  });

  it('reads a feed holding a single entry as an object', () => {
    expect(parseReviewsFeed(feedOf(entry('1', '5')))).toHaveLength(1);
  });

  it('skips entries without a rating', () => {
    expect(
      parseReviewsFeed(feedOf([entry('app'), entry('2', '4')])).map(
        (review) => review.id,
      ),
    ).toEqual(['2']);
  });

  it.each([
    'x',
    '0',
    '6',
    '4.5',
    '',
    ' 5',
    '05',
    '5.0',
    '1e0',
    '0x5',
    5,
    true,
    [5],
    null,
  ])('skips an entry rated %p instead of dropping the feed', (rating) => {
    expect(
      parseReviewsFeed(feedOf([entry('3', rating), entry('4', '5')])).map(
        (review) => review.id,
      ),
    ).toEqual(['4']);
  });

  it('reads a review without a body as empty text', () => {
    const withoutBody = { ...entry('5', '2'), content: undefined };

    expect(parseReviewsFeed(feedOf([withoutBody]))[0].text).toBe('');
  });

  it('skips the app entry apple places first on a page', () => {
    const app = {
      id: {
        label: 'https://apps.apple.com/us/app/id288429040',
        attributes: {},
      },
      title: { label: 'LinkedIn' },
      'im:name': { label: 'LinkedIn' },
    };

    expect(parseReviewsFeed(feedOf([app, entry('6', '3')]))).toHaveLength(1);
  });

  it('returns nothing for a feed without entries', () => {
    expect(parseReviewsFeed(feedOf())).toEqual([]);
  });

  it('refuses a payload that is not a reviews feed', () => {
    expect(() => parseReviewsFeed({ results: [] })).toThrow(
      'unexpected reviews feed shape',
    );
  });
});
