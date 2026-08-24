import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { ProxyPoolConfig } from './proxy-pool.config';

const CAPACITY_JUSTIFICATION =
  'pool capacity is an operator signal across every workspace';
const CACHE_TTL_MS = 30_000;

interface CachedCount {
  value: number;
  readAt: number;
}

@Injectable()
export class PoolCapacity {
  private readonly cache = new Map<Store, CachedCount>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ProxyPoolConfig,
  ) {}

  async concurrencyFor(store: Store): Promise<number | null> {
    if (!this.config.enabled) return null;
    const healthy = await this.healthy(store);
    return Math.min(Math.max(healthy, 1), this.config.maxWorkerConcurrency);
  }

  async healthy(store: Store, now = new Date()): Promise<number> {
    const cached = this.cache.get(store);
    if (cached && now.getTime() - cached.readAt < CACHE_TTL_MS) {
      return cached.value;
    }
    const value =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        CAPACITY_JUSTIFICATION,
        () => this.count(store, now),
      );
    this.cache.set(store, { value, readAt: now.getTime() });
    return value;
  }

  private count(store: Store, now: Date): Promise<number> {
    return this.prisma.proxyEndpoint.count({
      where: {
        enabled: true,
        retiredAt: null,
        health: {
          none: { store, cooldownUntil: { gt: now } },
        },
      },
    });
  }
}
