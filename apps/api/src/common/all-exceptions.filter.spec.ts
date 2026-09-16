import {
  ArgumentsHost,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Store } from '@prisma/client';
import { ApiErrorEnvelope } from '@asobeast/shared';
import { BillingConflictError } from '../billing/billing.errors';
import { ErrorTracking } from '../observability/error-tracking.service';
import { StoreNotSupportedError } from '../store-providers/errors';
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
});
