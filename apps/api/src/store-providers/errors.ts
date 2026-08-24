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
