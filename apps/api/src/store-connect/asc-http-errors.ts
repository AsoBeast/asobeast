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
import { InvalidPrivateKeyError } from './asc-token';

export const KEY_REFUSED =
  'App Store Connect refused this key. Check the issuer ID and the key ID, and that the key is active.';

export const RATE_LIMIT_RETRY_SECONDS = 60;

export function toHttpException(error: unknown): unknown {
  if (error instanceof InvalidPrivateKeyError) {
    return new BadRequestException(error.message);
  }
  if (error instanceof AscUnreachableError) {
    return new BadGatewayException(error.message);
  }
  if (error instanceof AscRejectedKeyError) {
    return new UnprocessableEntityException(KEY_REFUSED);
  }
  if (error instanceof AscRateLimitedError) {
    return new RequestThrottledError(
      RATE_LIMIT_RETRY_SECONDS,
      'App Store Connect asked to slow down.',
    );
  }
  if (error instanceof AscError) {
    return new BadGatewayException(
      `App Store Connect answered ${error.status}: ${error.message}`,
    );
  }
  return error;
}
