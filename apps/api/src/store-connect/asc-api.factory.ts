import { Inject, Injectable } from '@nestjs/common';
import { AscAnalyticsApi } from './asc-analytics-api';
import { AscRequester } from './asc-requester';
import { type AscCredentials, AscTokenCache } from './asc-token';
import { ASC_TRANSPORT, type AscTransport } from './asc-transport';

@Injectable()
export class AscApiFactory {
  constructor(
    @Inject(ASC_TRANSPORT) private readonly transport: AscTransport,
  ) {}

  open(credentials: AscCredentials): AscAnalyticsApi {
    return new AscAnalyticsApi(
      new AscRequester(this.transport, new AscTokenCache(credentials)),
    );
  }
}
