import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { Dispatcher } from 'undici';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { StorePoolBusyError } from '../errors';
import { pause, storeDeadline, storeDeadlineEndsAt } from '../store-deadline';
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

export const LEASE_HOLD_MS = 5 * 60_000;
export const STORE_CALL_MS = 12_000;
export const INTERACTIVE_POLL_MS = 1_000;

export interface ProxyLease {
  endpointId: string;
  dispatcher: Dispatcher;
  leasedAt: Date;
}

export interface LeasePacing {
  leasedAt: Date;
  until: Date;
}

interface PoolUnavailableOptions extends ErrorOptions {
  message?: string;
}

export class ProxyPoolUnavailableError extends Error {
  constructor(
    store: Store,
    waitedMs: number,
    readonly retryInMs: number,
    { message, ...options }: PoolUnavailableOptions = {},
  ) {
    super(
      message ??
        `No proxy endpoint became available for ${store} within ${waitedMs}ms`,
      options,
    );
    this.name = 'ProxyPoolUnavailableError';
  }
}

export class ProxyAccountRefusedError extends ProxyPoolUnavailableError {
  constructor(
    store: Store,
    status: number,
    retryInMs: number,
    options?: ErrorOptions,
  ) {
    super(store, 0, retryInMs, {
      ...options,
      message: `The proxy refused the ${store} tunnel (HTTP ${status}), so the work waits ${retryInMs}ms for the account`,
    });
    this.name = 'ProxyAccountRefusedError';
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

interface LeaseWait {
  giveUpAt: number;
  pollMs: number;
  reserve: number;
  signal?: AbortSignal;
  exhausted: (waitMs: number) => Error;
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

  async acquire(
    store: Store,
    country?: string,
    waitForLocal = true,
  ): Promise<ProxyLease | null> {
    if (!this.config.enabled) return null;

    const wait = this.waitPolicy(store);
    let lastWaitMs = wait.pollMs;
    for (;;) {
      if (wait.signal?.aborted) throw wait.exhausted(lastWaitMs);
      const lease =
        await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
          POOL_JUSTIFICATION,
          () => this.tryAcquire(store, country, waitForLocal, wait.reserve),
        );
      if (lease.kind === 'endpoint') return lease.lease;

      if (this.shutdown.stopped) throw new ProxyPoolStoppingError(store);

      lastWaitMs = lease.waitMs;
      const remaining = wait.giveUpAt - Date.now();
      if (remaining <= 0) throw wait.exhausted(lastWaitMs);
      await pause(Math.min(lease.waitMs, wait.pollMs, remaining), wait.signal);
    }
  }

  private waitPolicy(store: Store): LeaseWait {
    const { signal } = storeDeadline();
    const endsAt = storeDeadlineEndsAt();
    if (signal && endsAt !== null) {
      return {
        giveUpAt: endsAt - STORE_CALL_MS,
        pollMs: INTERACTIVE_POLL_MS,
        reserve: 0,
        signal,
        exhausted: (waitMs) => new StorePoolBusyError(store, waitMs),
      };
    }
    return {
      giveUpAt: Date.now() + this.config.acquireTimeoutMs,
      pollMs: this.config.pollMs,
      reserve: this.config.interactiveReserve,
      exhausted: () =>
        new ProxyPoolUnavailableError(
          store,
          this.config.acquireTimeoutMs,
          this.config.pollMs,
        ),
    };
  }

  release(
    endpointId: string,
    store: Store,
    { leasedAt, until }: LeasePacing,
  ): Promise<void> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      POOL_JUSTIFICATION,
      async () => {
        await this.prisma.proxyHealth.updateMany({
          where: { endpointId, store, lastUsedAt: leasedAt },
          data: { pacedUntil: until },
        });
      },
    );
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
    return {
      endpointId,
      dispatcher: this.dispatcherFor(endpoint),
      leasedAt: new Date(),
    };
  }

  private async tryAcquire(
    store: Store,
    country: string | undefined,
    waitForLocal: boolean,
    reserve: number,
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
      const now = new Date();
      const selection = selectEndpoint({
        candidates: rows
          .map(toCandidate)
          .map((candidate) =>
            contended.has(candidate.endpointId)
              ? { ...candidate, lastUsedAt: now }
              : candidate,
          ),
        now,
        minIntervalMs: this.config.minIntervalMs,
        reserve,
        ...(country && isGeoSensitive(store) ? { country, waitForLocal } : {}),
      });

      if (selection.kind === 'empty') {
        return { kind: 'wait', waitMs: this.config.pollMs };
      }
      if (selection.kind === 'wait') {
        return { kind: 'wait', waitMs: Math.max(selection.waitMs, 1) };
      }

      const chosen = rows.find((row) => row.id === selection.endpointId);
      if (!chosen) return { kind: 'wait', waitMs: this.config.pollMs };

      const leasedAt = await this.claim(chosen.id, store);
      if (leasedAt) {
        return {
          kind: 'endpoint',
          lease: {
            endpointId: chosen.id,
            dispatcher: this.dispatcherFor(chosen),
            leasedAt,
          },
        };
      }
      contended.add(chosen.id);
    }
  }

  private async claim(endpointId: string, store: Store): Promise<Date | null> {
    const leasedAt = new Date();
    const notBefore = new Date(leasedAt.getTime() - this.config.minIntervalMs);
    const heldUntil = new Date(leasedAt.getTime() + LEASE_HOLD_MS);
    const claimed = await this.prisma.$queryRaw<{ endpointId: string }[]>`
      INSERT INTO "ProxyHealth" ("endpointId", "store", "lastUsedAt", "pacedUntil", "windowStartedAt", "updatedAt")
      SELECT e."id", ${store}::"Store", ${leasedAt}, ${heldUntil}, ${leasedAt}, ${leasedAt}
      FROM "ProxyEndpoint" e
      WHERE e."id" = ${endpointId}
        AND e."enabled" = true
        AND e."retiredAt" IS NULL
      ON CONFLICT ("endpointId", "store") DO UPDATE
        SET "lastUsedAt" = ${leasedAt}, "pacedUntil" = ${heldUntil}, "updatedAt" = ${leasedAt}
        WHERE ("ProxyHealth"."lastUsedAt" IS NULL OR "ProxyHealth"."lastUsedAt" <= ${notBefore})
          AND ("ProxyHealth"."cooldownUntil" IS NULL OR "ProxyHealth"."cooldownUntil" <= ${leasedAt})
          AND ("ProxyHealth"."pacedUntil" IS NULL OR "ProxyHealth"."pacedUntil" <= ${leasedAt})
      RETURNING "endpointId"
    `;
    return claimed.length > 0 ? leasedAt : null;
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
