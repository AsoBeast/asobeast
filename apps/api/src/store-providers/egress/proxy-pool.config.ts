import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env';
import { ProxyCredentials } from './egress';
import { ResidentialTariff } from './residential-spend';

export const POOL_CREDENTIAL_REF = 'env:PROXY_USERNAME';

const EMPTY_POOL_POLL_MS = 5_000;

@Injectable()
export class ProxyPoolConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get provider(): Env['PROXY_PROVIDER'] {
    return this.config.get('PROXY_PROVIDER', { infer: true });
  }

  get enabled(): boolean {
    return this.provider !== 'none';
  }

  get apiUrl(): string {
    return this.config.get('PROXY_API_URL', { infer: true });
  }

  get apiKey(): string {
    return this.config.get('PROXY_API_KEY', { infer: true }) ?? '';
  }

  get syncCron(): string {
    return this.config.get('CRON_PROXY_SYNC', { infer: true });
  }

  get endpointRpm(): number {
    return this.config.get('PROXY_ENDPOINT_RPM', { infer: true });
  }

  get minIntervalMs(): number {
    return Math.ceil(60_000 / this.endpointRpm);
  }

  get acquireTimeoutMs(): number {
    return this.config.get('PROXY_ACQUIRE_TIMEOUT_MS', { infer: true });
  }

  get emptyPollMs(): number {
    return EMPTY_POOL_POLL_MS;
  }

  get maxWorkerConcurrency(): number {
    return this.config.get('PROXY_WORKER_MAX_CONCURRENCY', { infer: true });
  }

  get residentialUrl(): string | undefined {
    return this.config.get('PROXY_RESIDENTIAL_URL', { infer: true });
  }

  get residentialCredentials(): ProxyCredentials | undefined {
    const username = this.config.get('PROXY_RESIDENTIAL_USERNAME', {
      infer: true,
    });
    const password = this.config.get('PROXY_RESIDENTIAL_PASSWORD', {
      infer: true,
    });
    return username ? { username, password: password ?? '' } : undefined;
  }

  get residentialTariff(): ResidentialTariff {
    return {
      mbPerRequest: this.config.get('PROXY_RESIDENTIAL_MB_PER_REQUEST', {
        infer: true,
      }),
      costPerGb: this.config.get('PROXY_RESIDENTIAL_COST_PER_GB', {
        infer: true,
      }),
      monthlyCapUsd: this.config.get('PROXY_RESIDENTIAL_MONTHLY_CAP_USD', {
        infer: true,
      }),
    };
  }

  credentialsFor(ref: string): ProxyCredentials | undefined {
    if (ref !== POOL_CREDENTIAL_REF) return undefined;
    const username = this.config.get('PROXY_USERNAME', { infer: true });
    const password = this.config.get('PROXY_PASSWORD', { infer: true });
    return username ? { username, password: password ?? '' } : undefined;
  }
}
