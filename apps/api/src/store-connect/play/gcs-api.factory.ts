import { Inject, Injectable } from '@nestjs/common';
import {
  isGoogleAccountCredentials,
  type PlayCredentials,
  type ServiceAccountCredentials,
} from '../store-credentials';
import { GcsApi, type GcsSource } from './gcs-api';
import { GCS_TRANSPORT, type GcsTransport } from './gcs-transport';
import {
  GOOGLE_OAUTH_CLIENT,
  type GoogleOAuthClient,
  refreshTokenGrant,
} from './google-sign-in';
import { PlayPublisherApi } from './play-publisher-api';
import { serviceAccountGrant } from './service-account';

@Injectable()
export class GcsApiFactory {
  constructor(
    @Inject(GCS_TRANSPORT) private readonly transport: GcsTransport,
    @Inject(GOOGLE_OAUTH_CLIENT)
    private readonly client: GoogleOAuthClient | null,
  ) {}

  open(credentials: PlayCredentials): GcsApi {
    return new GcsApi(this.transport, this.sourceOf(credentials));
  }

  private sourceOf(credentials: PlayCredentials): GcsSource {
    if (isGoogleAccountCredentials(credentials)) {
      return {
        grant: refreshTokenGrant(this.client, credentials.refreshToken),
        bucket: credentials.bucket,
        account: { kind: 'googleAccount', email: credentials.email },
      };
    }
    return {
      grant: serviceAccountGrant(credentials),
      bucket: credentials.bucket,
      account: { kind: 'key', email: credentials.clientEmail },
    };
  }

  publisher(credentials: ServiceAccountCredentials): PlayPublisherApi {
    return new PlayPublisherApi(this.transport, credentials);
  }
}
