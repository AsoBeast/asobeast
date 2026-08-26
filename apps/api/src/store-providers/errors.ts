import { Store } from '@prisma/client';

export class StoreRequestError extends Error {
  constructor(
    readonly store: Store,
    readonly method: string,
    readonly causeMessage: string,
  ) {
    super(`${store} ${method} failed: ${causeMessage}`);
    this.name = 'StoreRequestError';
  }
}

export class StoreAppNotFoundError extends Error {
  constructor(
    readonly store: Store,
    readonly storeAppId: string,
  ) {
    super(`${store} has no app ${storeAppId}`);
    this.name = 'StoreAppNotFoundError';
  }
}

const NOT_FOUND_PATTERN = /not found/i;

export function isMissingApp(error: unknown): boolean {
  return NOT_FOUND_PATTERN.test(
    error instanceof Error ? error.message : String(error),
  );
}

export class ImplausibleResultError extends Error {
  constructor(
    readonly store: Store,
    readonly detail: string,
  ) {
    super(`${store} returned an implausible result: ${detail}`);
    this.name = 'ImplausibleResultError';
  }
}

export class StoreNotSupportedError extends Error {
  constructor(readonly store: Store) {
    super(`Store ${store} is not supported`);
    this.name = 'StoreNotSupportedError';
  }
}
