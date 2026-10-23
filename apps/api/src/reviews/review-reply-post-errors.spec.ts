import {
  BadGatewayException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import {
  AscAgreementError,
  AscError,
  AscRateLimitedError,
  AscUnreachableError,
} from '../store-connect/asc-errors';
import { AGREEMENT_MISSING } from '../store-connect/asc-http-errors';
import {
  GcsError,
  GcsRateLimitedError,
  GcsTokenRefusedError,
} from '../store-connect/play/gcs-api';
import { GcsUnreachableError } from '../store-connect/play/gcs-transport';
import { SignInOffError } from '../store-connect/play/google-sign-in';
import {
  PlayForbiddenError,
  PlayReplyRefusedError,
  PlayReviewMissingError,
} from '../store-connect/play/play-publisher-api';
import {
  AscReviewNotFoundError,
  REVIEW_NOT_IN_APP_STORE_CONNECT,
} from './asc-review-locator.service';
import {
  PLAY_KEY_REFUSED,
  PLAY_REVIEW_MISSING,
  postRefusalOf,
  REPLY_ROLE_NEEDED,
} from './review-reply-post-errors';

const statusOf = (exception: unknown): number =>
  exception instanceof RequestThrottledError
    ? 429
    : (exception as HttpException).getStatus();

const messageOf = (exception: unknown): string => (exception as Error).message;

describe('postRefusalOf', () => {
  it('passes an http answer through unchanged', () => {
    const conflict = new ConflictException('connect first');

    expect(postRefusalOf(conflict)).toEqual({
      exception: conflict,
    });
  });

  it.each([
    [
      'APP_STORE' as const,
      new AscError('Already responded', 409, 'ENTITY_ERROR'),
    ],
    ['APP_STORE' as const, new AscError('Too long', 422, 'ENTITY_ERROR')],
    ['GOOGLE_PLAY' as const, new PlayReplyRefusedError('Too long', 400)],
  ])('turns a refusal of %s into 422 with the store words', (store, error) => {
    const { exception, forbidden, rejected } = postRefusalOf(error);

    expect(statusOf(exception)).toBe(422);
    expect(messageOf(exception)).toBe(
      `${store === 'APP_STORE' ? 'App Store Connect' : 'Google Play'} refused the reply: ${error.message}`,
    );
    expect(forbidden).toBeUndefined();
    expect(rejected).toBeUndefined();
  });

  it.each([
    [new AscReviewNotFoundError(), REVIEW_NOT_IN_APP_STORE_CONNECT],
    [new AscError('gone', 404, 'NOT_FOUND'), REVIEW_NOT_IN_APP_STORE_CONNECT],
    [new PlayReviewMissingError('gone', 404), PLAY_REVIEW_MISSING],
  ])('turns an unknown review into 404', (error, message) => {
    const { exception } = postRefusalOf(error);

    expect(exception).toBeInstanceOf(NotFoundException);
    expect(messageOf(exception)).toBe(message);
  });

  it('marks the connection rejected for a missing agreement and a refused google credential', () => {
    expect(
      postRefusalOf(
        new AscAgreementError(
          'agreement',
          403,
          'FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED',
        ),
      ),
    ).toMatchObject({ rejected: AGREEMENT_MISSING });
    expect(
      postRefusalOf(new GcsTokenRefusedError('refused', 400, 'invalid_grant')),
    ).toMatchObject({ rejected: PLAY_KEY_REFUSED });
  });

  it('names the play permission and keeps the reason google gave', () => {
    const { exception, forbidden } = postRefusalOf(
      new PlayForbiddenError(
        'Google Play Android Developer API has not been used in project 42.',
        403,
      ),
    );

    expect(forbidden).toBe(true);
    expect(statusOf(exception)).toBe(403);
    expect(messageOf(exception)).toBe(
      `${REPLY_ROLE_NEEDED.GOOGLE_PLAY} Google said: Google Play Android Developer API has not been used in project 42.`,
    );
  });

  it.each([
    new AscRateLimitedError('slow down', 429, null),
    new GcsRateLimitedError('slow down', 429),
  ])('turns a store rate limit into 429 with a retry after', (error) => {
    const { exception } = postRefusalOf(error);

    expect(exception).toBeInstanceOf(RequestThrottledError);
    expect((exception as RequestThrottledError).retryAfterSeconds).toBe(60);
  });

  it.each([
    new AscUnreachableError('timed out'),
    new GcsUnreachableError('timed out'),
    new GcsError('boom', 500),
    new AscError('boom', 500, null),
  ])('turns an unreachable or failing store into 502', (error) => {
    expect(postRefusalOf(error).exception).toBeInstanceOf(BadGatewayException);
  });

  it('answers 409 when the google sign in client is off', () => {
    expect(postRefusalOf(new SignInOffError()).exception).toBeInstanceOf(
      ConflictException,
    );
  });
});
