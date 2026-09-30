import {
  ArgumentsHost,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Store } from '@prisma/client';
import { ApiErrorEnvelope } from '@asobeast/shared';
import { BillingConflictError } from '../billing/billing.errors';
import { ErrorTracking } from '../observability/error-tracking.service';
import {
  StoreAppNotFoundError,
  StoreNotSupportedError,
  StoreRequestError,
} from '../store-providers/errors';
import { AllExceptionsFilter } from './all-exceptions.filter';

const FUTURE_STORE = 'AMAZON' as Store;

function capture(exception: unknown): {
  status: number;
  envelope: ApiErrorEnvelope;
  headers: Record<string, string>;
} {
  const json = jest.fn<void, [ApiErrorEnvelope]>();
  const status = jest.fn<{ json: typeof json }, [number]>(() => ({ json }));
  const setHeader = jest.fn<void, [string, string]>();
  const response = { status, setHeader };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', url: '/apps' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter({
    capture: jest.fn(),
  } as unknown as ErrorTracking).catch(exception, host);

  return {
    status: status.mock.calls[0][0],
    envelope: json.mock.calls[0][0],
    headers: Object.fromEntries(setHeader.mock.calls),
  };
}

describe('AllExceptionsFilter', () => {
  it('names the store a request asked for that this version cannot serve', () => {
    const { status, envelope } = capture(
      new StoreNotSupportedError(FUTURE_STORE),
    );

    expect(status).toBe(HttpStatus.NOT_IMPLEMENTED);
    expect(envelope.message).toContain(FUTURE_STORE);
  });

  it('does not name google play, which this version serves', () => {
    const { envelope } = capture(new StoreNotSupportedError(FUTURE_STORE));

    expect(envelope.message.toLowerCase()).not.toContain('google play');
  });

  it('tells a refused checkout where the customer can recover', () => {
    const { status, envelope } = capture(
      new BillingConflictError('subscription_exists', 'Already subscribed'),
    );

    expect(status).toBe(HttpStatus.CONFLICT);
    expect(envelope.billing).toEqual({
      reason: 'subscription_exists',
      recovery: 'portal',
    });
  });

  it('tells a caller to retry while a checkout is still being opened', () => {
    const { envelope } = capture(
      new BillingConflictError('checkout_in_flight', 'Try again shortly'),
    );

    expect(envelope.billing).toEqual({
      reason: 'checkout_in_flight',
      recovery: 'retry',
    });
  });

  it('challenges an unauthenticated caller to present a bearer token', () => {
    const { headers } = capture(new UnauthorizedException());

    expect(headers['WWW-Authenticate']).toBe('Bearer realm="asobeast"');
  });

  it.each([
    [HttpStatus.FORBIDDEN, new ForbiddenException()],
    [HttpStatus.NOT_FOUND, new NotFoundException()],
    [
      HttpStatus.TOO_MANY_REQUESTS,
      new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS),
    ],
  ])('sends no challenge with a %i', (_status, exception) => {
    const { headers } = capture(exception);

    expect(headers['WWW-Authenticate']).toBeUndefined();
  });

  it('answers a store outage with a stable sentence and keeps the 502', () => {
    const { status, envelope } = capture(
      new StoreRequestError(Store.APP_STORE, 'getApp', 'fetch failed'),
    );

    expect(status).toBe(HttpStatus.BAD_GATEWAY);
    expect(envelope.error).toBe('Bad Gateway');
    expect(envelope.message).toBe(
      'The App Store did not answer. Try again in a few minutes.',
    );
    expect(envelope.message).not.toContain('fetch failed');
  });

  it('names google play when its request fails', () => {
    const { envelope } = capture(
      new StoreRequestError(Store.GOOGLE_PLAY, 'getApp', 'ECONNRESET'),
    );

    expect(envelope.message).toBe(
      'Google Play did not answer. Try again in a few minutes.',
    );
  });

  it('does not show the internal store name when an app is missing', () => {
    const { status, envelope } = capture(
      new StoreAppNotFoundError(Store.APP_STORE, '904237743'),
    );

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(envelope.message).toBe('The App Store has no app 904237743.');
  });

  it('keeps the underlying message for the operator', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    capture(new StoreRequestError(Store.APP_STORE, 'getApp', 'fetch failed'));

    expect(warn).toHaveBeenCalledWith('APP_STORE getApp failed: fetch failed');
    warn.mockRestore();
  });
});
