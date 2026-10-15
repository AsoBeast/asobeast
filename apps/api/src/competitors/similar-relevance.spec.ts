import { SearchItem } from '../store-providers/types';
import { closestSimilar, listingTerms } from './similar-relevance';

const app = (storeAppId: string, title: string, summary?: string) =>
  ({ storeAppId, title, ...(summary ? { summary } : {}) }) as SearchItem;

const ids = (items: SearchItem[]) => items.map((item) => item.storeAppId);

describe('listingTerms', () => {
  it('reads the title, subtitle and summary without function words', () => {
    const terms = listingTerms({
      title: 'Lingo: Learn Languages',
      subtitle: null,
      summary: 'Learn Spanish with fun lessons',
      languages: ['en'],
    });

    expect(terms).toEqual(
      expect.arrayContaining(['lingo', 'learn', 'spanish', 'lessons']),
    );
    expect(terms).not.toContain('with');
  });

  it('segments a spaceless title into words', () => {
    const terms = listingTerms({
      title: '英語学習アプリ',
      subtitle: null,
      summary: null,
      languages: ['ja'],
    });

    expect(terms.length).toBeGreaterThan(0);
    expect(terms.every((term) => '英語学習アプリ'.includes(term))).toBe(true);
  });
});

describe('closestSimilar', () => {
  const terms = ['learn', 'spanish', 'french', 'english', 'lessons'];

  it('drops the apps that share far fewer terms than the closest one', () => {
    const kept = closestSimilar(terms, [
      app('video', 'Video Tube', 'Watch videos and learn something new'),
      app('pins', 'Pin Board', 'Discover recipes and home ideas'),
      app('words', 'Word Lab', 'Learn Spanish, French and English lessons'),
    ]);

    expect(ids(kept)).toEqual(['words']);
  });

  it('orders the kept apps by shared terms, then by store order', () => {
    const kept = closestSimilar(terms, [
      app('two-a', 'Learn Spanish'),
      app('four', 'Learn Spanish and French lessons'),
      app('two-b', 'Spanish lessons'),
    ]);

    expect(ids(kept)).toEqual(['four', 'two-a', 'two-b']);
  });

  it('judges the title alone when the store sends no summary', () => {
    const kept = closestSimilar(terms, [
      app('titled', 'Learn English'),
      app('other', 'Photo Editor'),
    ]);

    expect(ids(kept)).toEqual(['titled']);
  });

  it('names nothing when no app shares a term', () => {
    expect(closestSimilar(terms, [app('pins', 'Pin Board')])).toEqual([]);
  });

  it('keeps the store order when the listing has no terms', () => {
    const similar = [app('b', 'B'), app('a', 'A')];

    expect(closestSimilar([], similar)).toEqual(similar);
  });
});
