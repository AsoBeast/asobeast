import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type {
  AppStoreConnectionRequest,
  PlayConnectionRequest,
  StoreCredentialKind,
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
import { identityFingerprint, publicKeyFingerprint } from './key-fingerprint';
import { type GcsApi, GcsError, GcsRateLimitedError } from './play/gcs-api';
import { GcsApiFactory } from './play/gcs-api.factory';
import type { PlayPublisherApi } from './play/play-publisher-api';
import { GcsUnreachableError } from './play/gcs-transport';
import { SignInOffError } from './play/google-sign-in';
import { playRefusal } from './play/play-refusal';
import {
  parseServiceAccount,
  rsaKey,
  ServiceAccountError,
} from './play/service-account';
import type {
  GoogleAccountCredentials,
  PlayCredentials,
  ServiceAccountCredentials,
  StoreCredentials,
} from './store-credentials';

export interface ParsedKey<C extends StoreCredentials> {
  credentials: C;
  credential: StoreCredentialKind;
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
        credential: 'key',
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

  parse(request: PlayConnectionRequest): ParsedKey<ServiceAccountCredentials> {
    try {
      const account = parseServiceAccount(request.serviceAccountJson);
      return {
        credentials: { ...account, bucket: request.bucket },
        credential: 'key',
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

  signedIn(
    credentials: GoogleAccountCredentials,
    subject: string,
  ): ParsedKey<GoogleAccountCredentials> {
    return {
      credentials,
      credential: 'googleAccount',
      issuerId: credentials.email,
      keyId: subject,
      keyFingerprint: identityFingerprint(`${credentials.email}#${subject}`),
      bucket: credentials.bucket,
    };
  }

  api(credentials: PlayCredentials): GcsApi {
    return this.factory.open(credentials);
  }

  publisher(credentials: ServiceAccountCredentials): PlayPublisherApi {
    return this.factory.publisher(credentials);
  }

  async refusal(credentials: PlayCredentials): Promise<string | null> {
    const api = this.api(credentials);
    try {
      await api.verify();
      return null;
    } catch (error) {
      const refusal = playRefusal(error, api);
      if (refusal) return refusal;
      if (error instanceof SignInOffError) {
        throw new ConflictException(error.message);
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
