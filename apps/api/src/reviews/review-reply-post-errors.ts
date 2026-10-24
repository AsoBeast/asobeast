import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Store } from '@asobeast/shared';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import {
  AscError,
  AscForbiddenError,
  AscRejectedKeyError,
} from '../store-connect/asc-errors';
import {
  RATE_LIMIT_RETRY_SECONDS,
  refusalOf,
  toHttpException,
} from '../store-connect/asc-http-errors';
import {
  GcsError,
  GcsRateLimitedError,
  GcsRejectedError,
} from '../store-connect/play/gcs-api';
import { GcsUnreachableError } from '../store-connect/play/gcs-transport';
import { SignInOffError } from '../store-connect/play/google-sign-in';
import {
  PlayApiDisabledError,
  PlayForbiddenError,
  PlayReplyRefusedError,
  PlayReviewMissingError,
} from '../store-connect/play/play-publisher-api';
import {
  AscReviewNotFoundError,
  REVIEW_NOT_IN_APP_STORE_CONNECT,
} from './asc-review-locator.service';

export const STORE_CONSOLE_NAMES: Record<Store, string> = {
  APP_STORE: 'App Store Connect',
  GOOGLE_PLAY: 'Google Play',
};

export const REPLY_ROLE_NEEDED: Record<Store, string> = {
  APP_STORE:
    'This App Store Connect key cannot respond to reviews. Connect a key with the Admin or Customer Support role.',
  GOOGLE_PLAY:
    'Google Play does not let this connection reply to reviews. Give the service account or your Google account the Reply to reviews permission in Play Console.',
};

export const CONNECT_FIRST: Record<Store, string> = {
  APP_STORE:
    'Connect App Store Connect in Integrations, Store connections, to post replies from here.',
  GOOGLE_PLAY:
    'Connect Google Play in Integrations, Store connections, to post replies from here.',
};

export const PLAY_REPLY_SETUP_GUIDE =
  'https://docs.asobeast.com/guides/store-funnel#use-a-service-account-key';

export const playApiDisabled = (project: string | null): string =>
  `The Google Play Android Developer API is not enabled in ${project ? `Google Cloud project ${project}` : 'the Google Cloud project'} behind this connection: the OAuth client's project for a Google sign in, the service account's project for a key. Enable it there, then post again. See ${PLAY_REPLY_SETUP_GUIDE}`;

export const PLAY_REVIEW_MISSING =
  'Google Play does not know this review any more.';
export const PLAY_KEY_REFUSED =
  'Google refused the connected service account key or Google sign in. Verify it in Integrations, Store connections, or reconnect.';

const STORE_REFUSAL_STATUSES = new Set([400, 409, 422]);
const MISSING = 404;

export interface PostRefusal {
  exception: unknown;
  forbidden?: boolean;
  rejected?: string;
}

const storeRefused = (store: Store, reason: string): PostRefusal => ({
  exception: new UnprocessableEntityException(
    `${STORE_CONSOLE_NAMES[store]} refused the reply: ${reason}`,
  ),
});

const rejected = (reason: string): PostRefusal => ({
  exception: new UnprocessableEntityException(reason),
  rejected: reason,
});

function appleRefusal(error: AscError): PostRefusal {
  if (error instanceof AscRejectedKeyError) return rejected(refusalOf(error));
  if (error.status === MISSING) {
    return {
      exception: new NotFoundException(REVIEW_NOT_IN_APP_STORE_CONNECT),
    };
  }
  if (STORE_REFUSAL_STATUSES.has(error.status)) {
    return storeRefused('APP_STORE', error.message);
  }
  return { exception: toHttpException(error) };
}

function googleRefusal(error: GcsError): PostRefusal {
  if (error instanceof GcsRejectedError) return rejected(PLAY_KEY_REFUSED);
  if (error instanceof PlayReviewMissingError) {
    return { exception: new NotFoundException(PLAY_REVIEW_MISSING) };
  }
  if (error instanceof PlayReplyRefusedError) {
    return storeRefused('GOOGLE_PLAY', error.message);
  }
  if (error instanceof GcsRateLimitedError) {
    return {
      exception: new RequestThrottledError(
        RATE_LIMIT_RETRY_SECONDS,
        'Google asked to slow down.',
      ),
    };
  }
  return {
    exception: new BadGatewayException(`Google answered ${error.status}`),
  };
}

export function postRefusalOf(error: unknown): PostRefusal {
  if (error instanceof HttpException) return { exception: error };
  if (error instanceof AscForbiddenError) {
    return {
      exception: new ForbiddenException(REPLY_ROLE_NEEDED.APP_STORE),
      forbidden: true,
    };
  }
  if (error instanceof PlayApiDisabledError) {
    return { exception: new ConflictException(playApiDisabled(error.project)) };
  }
  if (error instanceof PlayForbiddenError) {
    return {
      exception: new ForbiddenException(
        `${REPLY_ROLE_NEEDED.GOOGLE_PLAY} Google said: ${error.message}`,
      ),
      forbidden: true,
    };
  }
  if (error instanceof AscReviewNotFoundError) {
    return { exception: new NotFoundException(error.message) };
  }
  if (error instanceof SignInOffError) {
    return { exception: new ConflictException(error.message) };
  }
  if (error instanceof GcsUnreachableError) {
    return { exception: new BadGatewayException(error.message) };
  }
  if (error instanceof AscError) return appleRefusal(error);
  if (error instanceof GcsError) return googleRefusal(error);
  return { exception: toHttpException(error) };
}
