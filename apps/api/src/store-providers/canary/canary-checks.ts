import { NormalizedApp, SearchItem } from '../types';

const REQUIRED_APP_FIELDS = ['storeAppId', 'title', 'description'] as const;

export class CanaryShapeError extends Error {
  constructor(readonly detail: string) {
    super(detail);
    this.name = 'CanaryShapeError';
  }
}

export function assertParsedApp(app: NormalizedApp): void {
  const missing = REQUIRED_APP_FIELDS.filter((field) => !app[field]);
  if (missing.length > 0) {
    throw new CanaryShapeError(`parsed app is missing ${missing.join(', ')}`);
  }
  if (typeof app.storeAppId !== 'string') {
    throw new CanaryShapeError('storeAppId is not a string');
  }
}

export function assertSearchResults(results: SearchItem[]): void {
  if (results.length === 0) {
    throw new CanaryShapeError('search returned no results');
  }
  if (results.some((item) => !item.storeAppId || !item.title)) {
    throw new CanaryShapeError(
      'a search result is missing storeAppId or title',
    );
  }
}
