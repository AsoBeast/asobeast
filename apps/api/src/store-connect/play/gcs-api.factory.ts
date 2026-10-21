import { Inject, Injectable } from '@nestjs/common';
import type { PlayCredentials } from '../store-credentials';
import { GcsApi } from './gcs-api';
import { GCS_TRANSPORT, type GcsTransport } from './gcs-transport';
import { PlayPublisherApi } from './play-publisher-api';

@Injectable()
export class GcsApiFactory {
  constructor(
    @Inject(GCS_TRANSPORT) private readonly transport: GcsTransport,
  ) {}

  open(credentials: PlayCredentials): GcsApi {
    return new GcsApi(this.transport, credentials, credentials.bucket);
  }

  publisher(credentials: PlayCredentials): PlayPublisherApi {
    return new PlayPublisherApi(this.transport, credentials);
  }
}
