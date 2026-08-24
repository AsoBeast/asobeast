import { ProxyProtocol, ProxyTier } from '@prisma/client';

export interface UpstreamProxy {
  externalId: string;
  host: string;
  port: number;
  protocol: ProxyProtocol;
  tier: ProxyTier;
  country?: string;
}

export interface ProxyProviderClient {
  readonly provider: string;
  list(): Promise<UpstreamProxy[]>;
}

export const PROXY_PROVIDER_CLIENT = Symbol('PROXY_PROVIDER_CLIENT');
