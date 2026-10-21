import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import type {
  AppStoreConnectionRequest,
  PlayConnectionRequest,
  StoreReportAccess,
} from '@asobeast/shared';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import type { AscAnalyticsApi } from './asc-analytics-api';
import { AscApiFactory } from './asc-api.factory';
import { AscRejectedKeyError } from './asc-errors';
import type { AscReviewsApi } from './asc-reviews-api';
import {
  RATE_LIMIT_RETRY_SECONDS,
  refusalOf,
  toHttpException,
} from './asc-http-errors';
import {
  keyFingerprintOf,
  normalizePrivateKey,
  type AscCredentials,
} from './asc-token';
import { publicKeyFingerprint } from './key-fingerprint';
import {
  type GcsApi,
  GcsBucketError,
  GcsError,
  GcsRateLimitedError,
  GcsRejectedError,
} from './play/gcs-api';
import { GcsApiFactory } from './play/gcs-api.factory';
import type { PlayPublisherApi } from './play/play-publisher-api';
import { GcsUnreachableError } from './play/gcs-transport';
import {
  parseServiceAccount,
  rsaKey,
  ServiceAccountError,
} from './play/service-account';
import type { PlayCredentials, StoreCredentials } from './store-credentials';

export const PLAY_REFUSED =
  'Google refused this service account. Invite its email in Play Console under Users and permissions with View app information and download bulk reports, and check the bucket id.';

export const bucketMissing = (bucket: string): string =>
  `Google Cloud Storage has no bucket ${bucket} this service account can read. Copy the bucket id from Download reports in Play Console.`;

export interface ParsedKey<C extends StoreCredentials> {
  credentials: C;
  issuerId: string;
  keyId: string;
  keyFingerprint: string;
  bucket: string | null;
}

export interface StoreKeys<R, C extends StoreCredentials, A> {
  readonly reportAccess: StoreReportAccess;
  parse(request: R): ParsedKey<C>;
  api(credentials: C): A;
  refusal(credentials: C): Promise<string | null>;
}

@Injectable()
export class AppStoreKeys implements StoreKeys<
  AppStoreConnectionRequest,
  AscCredentials,
  AscAnalyticsApi
> {
  readonly reportAccess: StoreReportAccess = 'unknown';

  constructor(private readonly factory: AscApiFactory) {}

  parse(request: AppStoreConnectionRequest): ParsedKey<AscCredentials> {
    const credentials: AscCredentials = {
      issuerId: request.issuerId,
      keyId: request.keyId,
      privateKey: normalizePrivateKey(request.privateKey),
    };
    try {
      return {
        credentials,
        issuerId: credentials.issuerId,
        keyId: credentials.keyId,
        keyFingerprint: keyFingerprintOf(credentials.privateKey),
        bucket: null,
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  api(credentials: AscCredentials): AscAnalyticsApi {
    return this.factory.open(credentials);
  }

  reviews(credentials: AscCredentials): AscReviewsApi {
    return this.factory.reviews(credentials);
  }

  async refusal(credentials: AscCredentials): Promise<string | null> {
    try {
      await this.api(credentials).verify();
      return null;
    } catch (error) {
      if (error instanceof AscRejectedKeyError) return refusalOf(error);
      throw toHttpException(error);
    }
  }
}

@Injectable()
export class PlayKeys implements StoreKeys<
  PlayConnectionRequest,
  PlayCredentials,
  GcsApi
> {
  readonly reportAccess: StoreReportAccess = 'admin';

  constructor(private readonly factory: GcsApiFactory) {}

  parse(request: PlayConnectionRequest): ParsedKey<PlayCredentials> {
    try {
      const account = parseServiceAccount(request.serviceAccountJson);
      return {
        credentials: { ...account, bucket: request.bucket },
        issuerId: account.clientEmail,
        keyId: account.privateKeyId,
        keyFingerprint: publicKeyFingerprint(rsaKey(account.privateKey)),
        bucket: request.bucket,
      };
    } catch (error) {
      if (error instanceof ServiceAccountError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  api(credentials: PlayCredentials): GcsApi {
    return this.factory.open(credentials);
  }

  publisher(credentials: PlayCredentials): PlayPublisherApi {
    return this.factory.publisher(credentials);
  }

  async refusal(credentials: PlayCredentials): Promise<string | null> {
    try {
      await this.api(credentials).verify();
      return null;
    } catch (error) {
      if (error instanceof GcsRejectedError) return PLAY_REFUSED;
      if (error instanceof GcsBucketError) {
        return bucketMissing(credentials.bucket);
      }
      if (error instanceof GcsRateLimitedError) {
        throw new RequestThrottledError(
          RATE_LIMIT_RETRY_SECONDS,
          'Google asked to slow down.',
        );
      }
      if (error instanceof GcsUnreachableError) {
        throw new BadGatewayException(error.message);
      }
      if (error instanceof GcsError) {
        throw new BadGatewayException(`Google answered ${error.status}`);
      }
      throw error;
    }
  }
}
