import { Store } from '@prisma/client';
import { UnrecoverableError } from 'bullmq';
import {
  ImplausibleResultError,
  StoreAppNotFoundError,
  StoreRequestError,
} from '../store-providers/errors';
import { withoutRetry } from './unrecoverable';

describe('withoutRetry', () => {
  it('stops a plausibility rejection from being retried', () => {
    const rejection = new ImplausibleResultError(
      Store.APP_STORE,
      'the review feed for 123 came back empty',
    );

    const converted = withoutRetry(rejection);

    expect(converted).toBeInstanceOf(UnrecoverableError);
    expect((converted as Error).message).toBe(rejection.message);
  });

  it('stops a delisted app from being retried', () => {
    const missing = new StoreAppNotFoundError(Store.APP_STORE, '9999999999');

    const converted = withoutRetry(missing);

    expect(converted).toBeInstanceOf(UnrecoverableError);
    expect((converted as Error).message).toBe(missing.message);
  });

  it('leaves a store request failure to the queue', () => {
    const failure = new StoreRequestError(
      Store.GOOGLE_PLAY,
      'search',
      'socket hang up',
    );

    expect(withoutRetry(failure)).toBe(failure);
  });

  it('leaves an unrecognised failure to the queue', () => {
    const failure = new Error('boom');

    expect(withoutRetry(failure)).toBe(failure);
  });
});
