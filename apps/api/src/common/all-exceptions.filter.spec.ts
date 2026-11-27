import {
  ArgumentsHost,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import { ApiErrorEnvelope, HealthStatus } from '@asobeast/shared';
import { AiAllowanceExceededError } from '../ai/ai-allowance.errors';
import { RateLimitExceededError } from '../auth/rate-limit/rate-limit.errors';
import { RedisUnavailableError } from '../redis/redis.errors';
import { DatabaseUnavailableError } from '../health/health.errors';
import { BillingConflictError } from '../billing/billing.errors';
import { ErrorTracking } from '../observability/error-tracking.service';
import {
  StoreAppNotFoundError,
  StoreNotSupportedError,
  StorePoolBusyError,
  StoreRequestError,
} from '../store-providers/errors';
import { ProxyPoolStoppingError } from '../store-providers/egress/proxy-pool.service';
import { UnknownChartGenreError } from '../charts/chart-key';
import { AllExceptionsFilter } from './all-exceptions.filter';

const FUTURE_STORE = 'AMAZON' as Store;

function capture(
  exception: unknown,
  request: Record<string, string> = { method: 'POST', url: '/apps' },
): {
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
      getRequest: () => request,
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

const PARSER_REFUSALS: [number, string, string, string][] = [
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
];

describe('AllExceptionsFilter', () => {
  it('reports the request path without its query string', () => {
    const { envelope } = capture(
      new UnauthorizedException('Not authenticated'),
      {
        method: 'POST',
        url: '/mcp?token=asob_0123456789abcdef',
        originalUrl: '/mcp?token=asob_0123456789abcdef',
      },
    );

    expect(envelope.path).toBe('/mcp');
    expect(JSON.stringify(envelope)).not.toContain('asob_');
  });

  it('does not echo the query string of an unknown route in the message', () => {
    const url = '/no-such-route?api_key=secret-value';
    const { envelope } = capture(new NotFoundException(`Cannot GET ${url}`), {
      method: 'GET',
      url,
      originalUrl: url,
    });

    expect(envelope.message).toBe('Cannot GET /no-such-route');
    expect(envelope.path).toBe('/no-such-route');
    expect(JSON.stringify(envelope)).not.toContain('secret-value');
  });

  it('keeps a path that has no query string exactly as it was', () => {
    const { envelope } = capture(new NotFoundException('Resource not found'), {
      method: 'GET',
      url: '/apps/cl123/keywords',
      originalUrl: '/apps/cl123/keywords',
    });

    expect(envelope.path).toBe('/apps/cl123/keywords');
    expect(envelope.message).toBe('Resource not found');
  });

  afterEach(() => jest.restoreAllMocks());

  it('answers a rate refusal with the headers of the window that closed', () => {
    const { headers } = capture(
      new RateLimitExceededError({
        window: 'day',
        rateClass: 'store',
        plan: 'trial',
        limit: 5,
        resetSeconds: 46_275,
        upgradeTo: 'indie',
        action: 'runDaily',
      }),
    );

    expect(headers).toMatchObject({
      'RateLimit-Limit': '5',
      'RateLimit-Remaining': '0',
      'RateLimit-Reset': '46275',
      'Retry-After': '46275',
    });
  });

  it('refuses a chart the store does not list with 400', () => {
    const { status, envelope } = capture(
      new UnknownChartGenreError('APP_STORE', '9999'),
    );

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(envelope.message).toBe('9999 is not an App Store chart category');
  });

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
      'The App Store could not be reached. Try again in a few minutes.',
    );
    expect(envelope.message).not.toContain('fetch failed');
  });

  it('names google play when its request fails', () => {
    const { envelope } = capture(
      new StoreRequestError(Store.GOOGLE_PLAY, 'getApp', 'ECONNRESET'),
    );

    expect(envelope.message).toBe(
      'Google Play could not be reached. Try again in a few minutes.',
    );
  });

  it.each([
    [
      'TimeoutError: The operation was aborted due to timeout',
      'Google Play took too long to answer. Try again in a few minutes.',
    ],
    [
      'Request failed with status 429',
      'Google Play turned the request away for now. Try again in a few minutes.',
    ],
    [
      'RequestError: fetch failed',
      'Google Play could not be reached. Try again in a few minutes.',
    ],
    [
      'ParseError: title selector not found',
      'Google Play answered something asobeast could not read. Try again later.',
    ],
  ])('answers each store failure reason with 502 (%s)', (cause, sentence) => {
    const { status, envelope, headers } = capture(
      new StoreRequestError(Store.GOOGLE_PLAY, 'getApp', cause),
    );

    expect(status).toBe(HttpStatus.BAD_GATEWAY);
    expect(envelope.error).toBe('Bad Gateway');
    expect(envelope.message).toBe(sentence);
    expect(envelope.retryAfterSeconds).toBeUndefined();
    expect(headers['Retry-After']).toBeUndefined();
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

  it('logs the not found answer that ended the request, with its storefront', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const { status } = capture(
      new StoreAppNotFoundError(
        Store.GOOGLE_PLAY,
        'com.ihg.apps.android',
        'us',
      ),
    );

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(warn).toHaveBeenCalledWith(
      'GOOGLE_PLAY has no app com.ihg.apps.android in us',
    );
    warn.mockRestore();
  });

  it('keeps a store that did not answer out of error tracking', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const { status, tracked } = capture(
      new StoreRequestError(
        Store.GOOGLE_PLAY,
        'getApp',
        'TimeoutError: The operation was aborted due to timeout',
      ),
    );

    expect(status).toBe(HttpStatus.BAD_GATEWAY);
    expect(tracked).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('still reports a store answer it could not read', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const { status, tracked } = capture(
      new StoreRequestError(
        Store.GOOGLE_PLAY,
        'getApp',
        "Cannot read properties of undefined (reading 'title')",
      ),
    );

    expect(status).toBe(HttpStatus.BAD_GATEWAY);
    expect(tracked).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it.each(PARSER_REFUSALS)(
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

  it.each(PARSER_REFUSALS)(
    'answers %i %s when the adapter hands over a parser refusal as %s',
    (statusCode, error, message, type) => {
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const { status, envelope, tracked } = capture(
        new HttpException(message, statusCode, {
          cause: bodyParserError(statusCode, message, type),
        }),
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

  it('names an exception whose body carries no error by its status', () => {
    const { status, envelope } = capture(
      new HttpException({ message: 'already linked' }, HttpStatus.CONFLICT),
    );

    expect(status).toBe(HttpStatus.CONFLICT);
    expect(envelope).toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      message: 'already linked',
    });
  });

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

  it('keeps a database refusal of stored text a 500 and reports it', () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const refusal = new Prisma.PrismaClientKnownRequestError(
      'Database error. Code: `22021`. Message: `invalid byte sequence for encoding "UTF8": 0x00`',
      {
        code: 'P2039',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            name: 'DriverAdapterError',
            cause: { originalCode: '22021', kind: 'postgres' },
          },
        },
      },
    );

    const { status, envelope, tracked } = capture(refusal);

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
  it('answers a busy pool with 503 and a retry hint', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const { status, envelope, headers } = capture(
      new StorePoolBusyError(Store.GOOGLE_PLAY, 4_200),
    );

    expect(status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(envelope).toMatchObject({
      statusCode: 503,
      error: 'Service Unavailable',
      message:
        'This server is busy reaching Google Play. Try again in 5 seconds.',
      retryAfterSeconds: 5,
    });
    expect(headers['Retry-After']).toBe('5');
    warn.mockRestore();
  });

  it('keeps a busy pool out of error tracking', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const { tracked } = capture(
      new StorePoolBusyError(Store.GOOGLE_PLAY, 4_200),
    );

    expect(tracked).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'GOOGLE_PLAY acquire failed: no proxy endpoint was free within the request budget',
    );
    warn.mockRestore();
  });

  it('answers a stopping pool with 503', () => {
    const { status, envelope, headers, tracked } = capture(
      new ProxyPoolStoppingError(Store.APP_STORE),
    );

    expect(status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(envelope).toMatchObject({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'The API is restarting. Try again in a few seconds.',
      retryAfterSeconds: 5,
    });
    expect(headers['Retry-After']).toBe('5');
    expect(tracked).not.toHaveBeenCalled();
  });

  it('still answers a store failure with 502', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const { status, envelope } = capture(
      new StoreRequestError(Store.GOOGLE_PLAY, 'getApp', 'fetch failed'),
    );

    expect(status).toBe(HttpStatus.BAD_GATEWAY);
    expect(envelope.message).toBe(
      'Google Play could not be reached. Try again in a few minutes.',
    );
    warn.mockRestore();
  });

  it('answers 503 with the wait and the health signals when the database is unreachable', () => {
    const health: HealthStatus = {
      status: 'error',
      db: 'down',
      redis: 'up',
      pipeline: null,
    };

    const { status, envelope, headers } = capture(
      new DatabaseUnavailableError(health),
      { method: 'GET', url: '/health' },
    );

    expect(status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(envelope).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: expect.stringContaining('database') as string,
      retryAfterSeconds: 5,
      path: '/health',
      timestamp: expect.any(String) as string,
      ...health,
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
