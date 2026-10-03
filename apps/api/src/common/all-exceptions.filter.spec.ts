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
import { AiAllowanceExceededError } from '../ai/ai-allowance.errors';
import { RedisUnavailableError } from '../redis/redis.errors';
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
  tracked: jest.Mock;
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

  const tracked = jest.fn();
  new AllExceptionsFilter({
    capture: tracked,
  } as unknown as ErrorTracking).catch(exception, host);

  return {
    status: status.mock.calls[0][0],
    envelope: json.mock.calls[0][0],
    headers: Object.fromEntries(setHeader.mock.calls),
    tracked,
  };
}

function bodyParserError(
  status: number,
  message: string,
  type: string,
  expose = true,
): Error {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    expose,
    type,
  });
}

describe('AllExceptionsFilter', () => {
  afterEach(() => jest.restoreAllMocks());

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

  it.each([
    [413, 'Payload Too Large', 'request entity too large', 'entity.too.large'],
    [413, 'Payload Too Large', 'too many parameters', 'parameters.too.many'],
    [
      415,
      'Unsupported Media Type',
      'unsupported charset "LATIN1"',
      'charset.unsupported',
    ],
    [
      415,
      'Unsupported Media Type',
      'unsupported content encoding "compress"',
      'encoding.unsupported',
    ],
    [400, 'Bad Request', 'request aborted', 'request.aborted'],
    [
      400,
      'Bad Request',
      'request size did not match content length',
      'request.size.invalid',
    ],
    [403, 'Forbidden', 'request verification failed', 'entity.verify.failed'],
  ])(
    'answers %i %s for a body the parser refused as %s',
    (statusCode, error, message, type) => {
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const { status, envelope, tracked } = capture(
        bodyParserError(statusCode, message, type),
      );

      expect(status).toBe(statusCode);
      expect(envelope).toMatchObject({
        statusCode,
        error,
        message,
        path: '/apps',
      });
      expect(logged).not.toHaveBeenCalled();
      expect(tracked).not.toHaveBeenCalled();
    },
  );

  it('keeps a server error from the parser a 500 with a generic message', () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const { status, envelope, tracked } = capture(
      bodyParserError(
        500,
        'stream encoding should not be set',
        'stream.encoding.set',
        false,
      ),
    );

    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(envelope.message).toBe('Internal server error');
    expect(logged).toHaveBeenCalledTimes(1);
    expect(tracked).toHaveBeenCalledTimes(1);
  });

  it('does not trust a client status on an error that is not exposed', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const { status, envelope } = capture(
      Object.assign(new Error('card declined with key sk_live_x'), {
        status: 402,
      }),
    );

    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(envelope.message).toBe('Internal server error');
  });

  it('does not invent a name for a status node does not know', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const { status } = capture(bodyParserError(499, 'closed', 'custom'));

    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('answers 503 with the wait when redis is unreachable', () => {
    const { status, envelope, headers } = capture(new RedisUnavailableError(5));

    expect(status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(envelope).toMatchObject({
      statusCode: 503,
      error: 'Service Unavailable',
      retryAfterSeconds: 5,
    });
    expect(headers['Retry-After']).toBe('5');
  });

  it('answers a spent ai allowance with 429, Retry-After and the allowance', () => {
    const detail = {
      plan: 'indie' as const,
      limit: 200,
      used: 200,
      resetsAt: '2026-11-01T00:00:00.000Z',
      upgradeTo: 'ultimate' as const,
    };
    const { status, envelope, headers, tracked } = capture(
      new AiAllowanceExceededError(detail, 3_600),
    );
    expect(status).toBe(429);
    expect(headers['Retry-After']).toBe('3600');
    expect(envelope).toMatchObject({
      statusCode: 429,
      aiAllowance: detail,
      retryAfterSeconds: 3_600,
    });
    expect(tracked).not.toHaveBeenCalled();
  });
});
