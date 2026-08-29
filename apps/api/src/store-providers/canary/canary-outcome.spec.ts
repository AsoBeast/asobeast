import { Store } from '@prisma/client';
import {
  ImplausibleResultError,
  StoreAppNotFoundError,
  StoreNotSupportedError,
  StoreRequestError,
} from '../errors';
import { CanaryShapeError } from './canary-checks';
import { outcomeOfError, TRANSPORT_MESSAGES } from './canary-outcome';

function requestError(causeMessage: string): StoreRequestError {
  return new StoreRequestError(Store.APP_STORE, 'getApp', causeMessage);
}

describe('outcomeOfError', () => {
  it('calls a delisted canary target missing rather than broken', () => {
    expect(
      outcomeOfError(new StoreAppNotFoundError(Store.APP_STORE, '284882215')),
    ).toBe('target-missing');
  });

  it('calls a shape mismatch broken', () => {
    expect(outcomeOfError(new CanaryShapeError('title is missing'))).toBe(
      'broken',
    );
  });

  it('calls an implausible result broken', () => {
    expect(
      outcomeOfError(new ImplausibleResultError(Store.APP_STORE, 'no rows')),
    ).toBe('broken');
  });

  it.each(TRANSPORT_MESSAGES)('calls %s unreachable', (marker) => {
    expect(outcomeOfError(requestError(`request failed: ${marker}`))).toBe(
      'unreachable',
    );
  });

  it('matches a transport marker whatever its case', () => {
    expect(outcomeOfError(requestError('Socket Hang Up'))).toBe('unreachable');
    expect(outcomeOfError(requestError('econnreset'))).toBe('unreachable');
  });

  it('calls a request failure with no transport marker broken', () => {
    expect(
      outcomeOfError(requestError('Cannot read properties of undefined')),
    ).toBe('broken');
  });

  it.each([
    ['a plain error', new Error('boom')],
    [
      'a store that is not supported',
      new StoreNotSupportedError(Store.APP_STORE),
    ],
    ['a string', 'boom'],
    ['undefined', undefined],
    ['null', null],
  ])(
    'calls %s broken because an unnamed failure is likelier a new shape',
    (_label, error) => {
      expect(outcomeOfError(error)).toBe('broken');
    },
  );
});
