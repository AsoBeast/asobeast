import { NormalizedApp, SearchItem } from '../types';

const REQUIRED_APP_FIELDS = ['storeAppId', 'title', 'description'] as const;

const REQUIRED_SEARCH_FIELDS = ['storeAppId', 'title'] as const;

export class CanaryShapeError extends Error {
  constructor(readonly detail: string) {
    super(detail);
    this.name = 'CanaryShapeError';
  }
}

export function assertParsedApp(app: NormalizedApp): void {
  assertStringFields('parsed app', REQUIRED_APP_FIELDS, app);
}

export function assertSearchResults(results: SearchItem[]): void {
  if (results.length === 0) {
    throw new CanaryShapeError('search returned no results');
  }
  for (const result of results) {
    assertStringFields('a search result', REQUIRED_SEARCH_FIELDS, result);
  }
}

function assertStringFields<T extends object>(
  subject: string,
  fields: readonly (keyof T & string)[],
  parsed: T,
): void {
  const missing = fields.filter((field) => !parsed[field]);
  if (missing.length > 0) {
    throw new CanaryShapeError(`${subject} is missing ${missing.join(', ')}`);
  }

  const mistyped = fields.filter((field) => typeof parsed[field] !== 'string');
  if (mistyped.length > 0) {
    throw new CanaryShapeError(
      `${subject} has a non-string ${mistyped.join(', ')}`,
    );
  }
}
