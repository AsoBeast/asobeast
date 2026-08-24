import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { Dispatcher } from 'undici';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { proxyDispatcher } from './egress';
import { PoolShutdown } from './pool-shutdown';
import { ProxyPoolConfig } from './proxy-pool.config';
import {
  isGeoSensitive,
  PoolCandidate,
  selectEndpoint,
} from './proxy-selection';

const POOL_JUSTIFICATION =
  'the proxy pool is operator infrastructure shared by every workspace';

export interface ProxyLease {
  endpointId: string;
  dispatcher: Dispatcher;
}

export class ProxyPoolUnavailableError extends Error {
  constructor(store: Store, waitedMs: number) {
    super(
      `No proxy endpoint became available for ${store} within ${waitedMs}ms`,
    );
    this.name = 'ProxyPoolUnavailableError';
  }
}

export class ProxyPoolStoppingError extends Error {
  constructor(store: Store) {
    super(
      `Stopped waiting for a ${store} proxy endpoint because the api is shutting down`,
    );
    this.name = 'ProxyPoolStoppingError';
  }
}

interface CachedDispatcher {
  address: string;
  dispatcher: Dispatcher;
}

interface EndpointRow {
  id: string;
  host: string;
  port: number;
  protocol: string;
  country: string | null;
  credentialRef: string;
  health: {
    cooldownUntil: Date | null;
    pacedUntil: Date | null;
    lastUsedAt: Date | null;
  }[];
}

@Injectable()
export class ProxyPool {
  private readonly logger = new Logger(ProxyPool.name);
  private readonly dispatchers = new Map<string, CachedDispatcher>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ProxyPoolConfig,
    private readonly shutdown: PoolShutdown,
  ) {}

  async acquire(store: Store, country?: string): Promise<ProxyLease | null> {
    if (!this.config.enabled) return null;

    const deadline = Date.now() + this.config.acquireTimeoutMs;
    for (;;) {
      const lease =
        await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
          POOL_JUSTIFICATION,
          () => this.tryAcquire(store, country),
        );
      if (lease.kind === 'endpoint') return lease.lease;

      if (this.shutdown.stopped) throw new ProxyPoolStoppingError(store);

      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new ProxyPoolUnavailableError(
          store,
          this.config.acquireTimeoutMs,
        );
      }
      await sleep(Math.min(lease.waitMs, remaining));
    }
  }

  async leaseEndpoint(endpointId: string): Promise<ProxyLease | null> {
    const endpoint =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        POOL_JUSTIFICATION,
        () =>
          this.prisma.proxyEndpoint.findUnique({
            where: { id: endpointId },
            select: {
              id: true,
              host: true,
              port: true,
              protocol: true,
              credentialRef: true,
            },
          }),
      );
    if (!endpoint) return null;
    return { endpointId, dispatcher: this.dispatcherFor(endpoint) };
  }

  private async tryAcquire(
    store: Store,
    country: string | undefined,
  ): Promise<
    { kind: 'endpoint'; lease: ProxyLease } | { kind: 'wait'; waitMs: number }
  > {
    const rows: EndpointRow[] = await this.prisma.proxyEndpoint.findMany({
      where: { enabled: true, retiredAt: null },
      select: {
        id: true,
        host: true,
        port: true,
        protocol: true,
        country: true,
        credentialRef: true,
        health: {
          where: { store },
          select: {
            cooldownUntil: true,
            pacedUntil: true,
            lastUsedAt: true,
          },
        },
      },
    });

    const contended = new Set<string>();
    for (;;) {
      const available = rows.filter((row) => !contended.has(row.id));
      if (available.length === 0) {
        return {
          kind: 'wait',
          waitMs:
            contended.size > 0
              ? this.config.minIntervalMs
              : this.config.emptyPollMs,
        };
      }

      const selection = selectEndpoint({
        candidates: available.map(toCandidate),
        now: new Date(),
        minIntervalMs: this.config.minIntervalMs,
        ...(country && isGeoSensitive(store) ? { country } : {}),
      });

      if (selection.kind === 'empty') {
        return { kind: 'wait', waitMs: this.config.emptyPollMs };
      }
      if (selection.kind === 'wait') {
        return { kind: 'wait', waitMs: Math.max(selection.waitMs, 1) };
      }

      const chosen = available.find((row) => row.id === selection.endpointId);
      if (!chosen) return { kind: 'wait', waitMs: this.config.emptyPollMs };

      if (await this.claim(chosen.id, store)) {
        return {
          kind: 'endpoint',
          lease: {
            endpointId: chosen.id,
            dispatcher: this.dispatcherFor(chosen),
          },
        };
      }
      contended.add(chosen.id);
    }
  }

  private async claim(endpointId: string, store: Store): Promise<boolean> {
    const notBefore = new Date(Date.now() - this.config.minIntervalMs);
    const claimed = await this.prisma.$queryRaw<{ endpointId: string }[]>`
      INSERT INTO "ProxyHealth" ("endpointId", "store", "lastUsedAt", "windowStartedAt", "updatedAt")
      SELECT e."id", ${store}::"Store", now(), now(), now()
      FROM "ProxyEndpoint" e
      WHERE e."id" = ${endpointId}
        AND e."enabled" = true
        AND e."retiredAt" IS NULL
      ON CONFLICT ("endpointId", "store") DO UPDATE
        SET "lastUsedAt" = now(), "updatedAt" = now()
        WHERE ("ProxyHealth"."lastUsedAt" IS NULL OR "ProxyHealth"."lastUsedAt" <= ${notBefore})
          AND ("ProxyHealth"."cooldownUntil" IS NULL OR "ProxyHealth"."cooldownUntil" <= now())
          AND ("ProxyHealth"."pacedUntil" IS NULL OR "ProxyHealth"."pacedUntil" <= now())
      RETURNING "endpointId"
    `;
    return claimed.length > 0;
  }

  private dispatcherFor(endpoint: {
    id: string;
    host: string;
    port: number;
    protocol: string;
    credentialRef: string;
  }): Dispatcher {
    const address = `${endpoint.protocol.toLowerCase()}://${endpoint.host}:${endpoint.port}`;
    const cached = this.dispatchers.get(endpoint.id);
    if (cached?.address === address) return cached.dispatcher;

    if (cached) {
      void cached.dispatcher.close().catch((error: unknown) => {
        this.logger.warn(`closing ${cached.address} failed: ${String(error)}`);
      });
    }
    const dispatcher = proxyDispatcher(
      address,
      this.config.credentialsFor(endpoint.credentialRef),
    );
    this.dispatchers.set(endpoint.id, { address, dispatcher });
    return dispatcher;
  }
}

function toCandidate(row: EndpointRow): PoolCandidate {
  const health = row.health[0];
  return {
    endpointId: row.id,
    country: row.country,
    cooldownUntil: health?.cooldownUntil ?? null,
    pacedUntil: health?.pacedUntil ?? null,
    lastUsedAt: health?.lastUsedAt ?? null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
