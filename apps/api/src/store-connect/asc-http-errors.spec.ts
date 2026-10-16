import {
  BadGatewayException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import {
  AscError,
  AscRateLimitedError,
  AscRejectedKeyError,
  AscUnreachableError,
} from './asc-errors';
import { KEY_REFUSED, toHttpException } from './asc-http-errors';
import { InvalidPrivateKeyError } from './asc-token';

describe('toHttpException', () => {
  it('answers 400 for a key that is not a P-256 key', () => {
    const mapped = toHttpException(new InvalidPrivateKeyError('not a key'));

    expect(mapped).toBeInstanceOf(BadRequestException);
    expect((mapped as BadRequestException).message).toBe('not a key');
  });

  it('answers 422 when Apple refuses the key', () => {
    const mapped = toHttpException(
      new AscRejectedKeyError('bad', 401, 'NOT_AUTHORIZED'),
    );

    expect(mapped).toBeInstanceOf(UnprocessableEntityException);
    expect((mapped as UnprocessableEntityException).message).toBe(KEY_REFUSED);
  });

  it('answers 502 when Apple cannot be reached', () => {
    expect(toHttpException(new AscUnreachableError('timeout'))).toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('answers 429 with a minute to wait when Apple asks to slow down', () => {
    const mapped = toHttpException(
      new AscRateLimitedError('slow', 429, 'RATE_LIMIT_EXCEEDED'),
    );

    expect(mapped).toBeInstanceOf(RequestThrottledError);
    expect((mapped as RequestThrottledError).retryAfterSeconds).toBe(60);
  });

  it('answers 502 with what Apple said for any other answer', () => {
    const mapped = toHttpException(new AscError('because', 500, 'X'));

    expect(mapped).toBeInstanceOf(BadGatewayException);
    expect((mapped as BadGatewayException).message).toBe(
      'App Store Connect answered 500: because',
    );
  });

  it('hands any other error back untouched', () => {
    const other = new Error('boom');

    expect(toHttpException(other)).toBe(other);
  });
});
