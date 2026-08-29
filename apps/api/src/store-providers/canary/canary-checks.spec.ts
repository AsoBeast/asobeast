import { Store } from '@prisma/client';
import { NormalizedApp, SearchItem } from '../types';
import {
  assertParsedApp,
  assertSearchResults,
  CanaryShapeError,
} from './canary-checks';

function appOf(overrides: Partial<NormalizedApp> = {}): NormalizedApp {
  return {
    store: Store.APP_STORE,
    storeAppId: '284882215',
    title: 'Facebook',
    description: 'Connect with friends.',
    raw: {},
    ...overrides,
  };
}

function searchItem(overrides: Partial<SearchItem> = {}): SearchItem {
  return { storeAppId: '284882215', title: 'Facebook', ...overrides };
}

describe('assertParsedApp', () => {
  it('accepts a fully populated app', () => {
    expect(() => assertParsedApp(appOf())).not.toThrow();
  });

  it.each(['storeAppId', 'title', 'description'] as const)(
    'names %s when it is missing',
    (field) => {
      expect(() => assertParsedApp(appOf({ [field]: '' }))).toThrow(
        new CanaryShapeError(`parsed app is missing ${field}`),
      );
    },
  );

  it('names every missing field at once', () => {
    expect(() =>
      assertParsedApp(appOf({ title: '', description: '' })),
    ).toThrow('parsed app is missing title, description');
  });

  it.each(['storeAppId', 'title', 'description'] as const)(
    'rejects a %s the store sent as a number',
    (field) => {
      const app = appOf({ [field]: 284882215 as unknown as string });

      expect(() => assertParsedApp(app)).toThrow(
        new CanaryShapeError(`parsed app has a non-string ${field}`),
      );
    },
  );

  it('names every mistyped field at once', () => {
    const app = appOf({
      title: 1 as unknown as string,
      description: 2 as unknown as string,
    });

    expect(() => assertParsedApp(app)).toThrow(
      'parsed app has a non-string title, description',
    );
  });

  it('throws a shape error the classifier can recognise', () => {
    expect(() => assertParsedApp(appOf({ title: '' }))).toThrow(
      CanaryShapeError,
    );
  });
});

describe('assertSearchResults', () => {
  it('accepts a healthy result set', () => {
    expect(() =>
      assertSearchResults([searchItem(), searchItem({ storeAppId: '2' })]),
    ).not.toThrow();
  });

  it('rejects an empty result set', () => {
    expect(() => assertSearchResults([])).toThrow(
      new CanaryShapeError('search returned no results'),
    );
  });

  it.each(['storeAppId', 'title'] as const)(
    'rejects a result missing %s',
    (field) => {
      expect(() =>
        assertSearchResults([searchItem(), searchItem({ [field]: '' })]),
      ).toThrow(new CanaryShapeError(`a search result is missing ${field}`));
    },
  );

  it.each(['storeAppId', 'title'] as const)(
    'rejects a result whose %s the store sent as a number',
    (field) => {
      expect(() =>
        assertSearchResults([
          searchItem(),
          searchItem({ [field]: 42 as unknown as string }),
        ]),
      ).toThrow(
        new CanaryShapeError(`a search result has a non-string ${field}`),
      );
    },
  );
});
