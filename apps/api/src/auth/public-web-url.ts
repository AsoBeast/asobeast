import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';

@Injectable()
export class PublicWebUrl {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get configured(): boolean {
    return Boolean(this.origin);
  }

  tokenLink(path: string, token: string, purpose: string): string {
    const origin = this.origin;
    if (!origin) {
      throw new ServiceUnavailableException(
        `WEB_PUBLIC_URL is not set, so a ${purpose} would have no host`,
      );
    }
    return `${origin}${path}?token=${token}`;
  }

  private get origin(): string | undefined {
    return this.config.get('WEB_PUBLIC_URL', { infer: true });
  }
}
