import { Injectable } from '@nestjs/common';
import { ProxyOutcome, ProxyTier, Store } from '@prisma/client';
import {
  PROXY_OUTCOMES,
  ProxyEndpointHealth,
  ProxyOutcomeCounts,
  ProxyPoolHealth,
  ProxyStoreHealth,
  ResidentialFallbackHealth,
  STORES,
} from '@asobeast/shared';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { ProxyLedger } from './proxy-ledger.service';
import { poolAlerts } from './proxy-pool-alerts';
import { ProxyPoolConfig } from './proxy-pool.config';
import { ResidentialFallback } from './residential-fallback.service';

const REPORT_JUSTIFICATION =
  'pool health is an operator signal across every workspace';

interface EndpointRow {
  id: string;
  host: string;
  port: number;
  country: string | null;
  enabled: boolean;
  retiredAt: Date | null;
  health: {
    store: Store;
    successes: number;
    failures: number;
    consecutiveFailures: number;
    cooldownUntil: Date | null;
    lastOutcome: ProxyOutcome | null;
    lastUsedAt: Date | null;
  }[];
}

@Injectable()
export class ProxyPoolHealthReport {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ProxyPoolConfig,
    private readonly residential: ResidentialFallback,
    private readonly ledger: ProxyLedger,
  ) {}

  async build(now = new Date()): Promise<ProxyPoolHealth> {
    const [rows, spend, datacenterRequests] = await Promise.all([
      this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        REPORT_JUSTIFICATION,
        () => this.endpoints(),
      ),
      this.residential.spend(),
      this.ledger.count(ProxyTier.DATACENTER),
    ]);

    const live = rows.filter((row) => row.retiredAt === null);
    const residential = this.residentialHealth(spend, datacenterRequests);
    const stores = STORES.map((store) => this.storeHealth(store, live, now));

    return {
      enabled: this.config.enabled,
      provider: this.config.provider,
      total: live.length,
      pending: live.filter((row) => !row.enabled).length,
      retired: rows.length - live.length,
      stores,
      endpoints: this.endpointHealth(live),
      residential,
      alerts: poolAlerts({ stores, residential }),
    };
  }

  private endpoints(): Promise<EndpointRow[]> {
    return this.prisma.proxyEndpoint.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        host: true,
        port: true,
        country: true,
        enabled: true,
        retiredAt: true,
        health: {
          select: {
            store: true,
            successes: true,
            failures: true,
            consecutiveFailures: true,
            cooldownUntil: true,
            lastOutcome: true,
            lastUsedAt: true,
          },
        },
      },
    });
  }

  private storeHealth(
    store: Store,
    rows: EndpointRow[],
    now: Date,
  ): ProxyStoreHealth {
    const serving = rows.filter((row) => row.enabled);
    const health = serving.map((row) =>
      row.health.find((entry) => entry.store === store),
    );
    const coolingDown = health.filter(
      (entry) => (entry?.cooldownUntil?.getTime() ?? 0) > now.getTime(),
    ).length;
    const successes = sum(health.map((entry) => entry?.successes ?? 0));
    const failures = sum(health.map((entry) => entry?.failures ?? 0));
    const healthy = serving.length - coolingDown;

    return {
      store,
      endpoints: serving.length,
      healthy,
      coolingDown,
      successRate: rate(successes, successes + failures),
      outcomes: countOutcomes(
        health.map((entry) => entry?.lastOutcome ?? null),
      ),
      requestsLastHour: successes + failures,
      capacityPerHour: healthy * this.config.endpointRpm * 60,
    };
  }

  private endpointHealth(rows: EndpointRow[]): ProxyEndpointHealth[] {
    return rows.flatMap((row) =>
      row.health.map((entry) => ({
        endpointId: row.id,
        address: `${row.host}:${row.port}`,
        country: row.country,
        store: entry.store,
        successes: entry.successes,
        failures: entry.failures,
        successRate: rate(entry.successes, entry.successes + entry.failures),
        consecutiveFailures: entry.consecutiveFailures,
        cooldownUntil: entry.cooldownUntil?.toISOString() ?? null,
        lastOutcome: entry.lastOutcome,
        lastUsedAt: entry.lastUsedAt?.toISOString() ?? null,
      })),
    );
  }

  private residentialHealth(
    spend: { month: string; requests: number; usd: number; capUsd: number },
    datacenterRequests: number,
  ): ResidentialFallbackHealth {
    return {
      configured: this.residential.configured,
      month: spend.month,
      requests: spend.requests,
      spendUsd: spend.usd,
      capUsd: spend.capUsd,
      fallbackRate:
        rate(spend.requests, spend.requests + datacenterRequests) ?? 0,
    };
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function rate(part: number, total: number): number | null {
  return total === 0 ? null : Math.round((part / total) * 1000) / 1000;
}

function countOutcomes(outcomes: (ProxyOutcome | null)[]): ProxyOutcomeCounts {
  const counts = Object.fromEntries(
    PROXY_OUTCOMES.map((outcome) => [outcome, 0]),
  ) as ProxyOutcomeCounts;
  for (const outcome of outcomes) {
    if (outcome) counts[outcome] += 1;
  }
  return counts;
}
