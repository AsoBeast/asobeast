import type { Store } from '../index';

export const PROXY_OUTCOMES = [
  'SUCCESS',
  'TRANSPORT',
  'RATE_LIMITED',
  'BLOCKED',
  'SILENT',
] as const;

export type ProxyOutcomeName = (typeof PROXY_OUTCOMES)[number];

export type ProxyOutcomeCounts = Record<ProxyOutcomeName, number>;

export interface ProxyStoreHealth {
  store: Store;
  endpoints: number;
  healthy: number;
  coolingDown: number;
  successRate: number | null;
  outcomes: ProxyOutcomeCounts;
  requestsLastHour: number;
  capacityPerHour: number;
}

export interface ProxyEndpointHealth {
  endpointId: string;
  address: string;
  country: string | null;
  store: Store;
  successes: number;
  failures: number;
  successRate: number | null;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  lastOutcome: ProxyOutcomeName | null;
  lastUsedAt: string | null;
}

export interface ResidentialFallbackHealth {
  configured: boolean;
  month: string;
  requests: number;
  spendUsd: number;
  capUsd: number;
  fallbackRate: number;
}

export type ProxyPoolAlert =
  | 'pool.healthy.low'
  | 'pool.blocked.rising'
  | 'pool.silent.rising'
  | 'residential.spend.near-cap';

export interface ProxyPoolHealth {
  enabled: boolean;
  provider: string;
  total: number;
  pending: number;
  retired: number;
  stores: ProxyStoreHealth[];
  endpoints: ProxyEndpointHealth[];
  residential: ResidentialFallbackHealth;
  alerts: ProxyPoolAlert[];
}
