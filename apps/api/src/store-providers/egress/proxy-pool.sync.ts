import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ProxyEndpoint } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { POOL_CREDENTIAL_REF, ProxyPoolConfig } from './proxy-pool.config';
import {
  PROXY_PROVIDER_CLIENT,
  ProxyProviderClient,
  UpstreamProxy,
} from './proxy-provider';

export interface ProxyPoolSyncResult {
  added: number;
  restored: number;
  retired: number;
  total: number;
}

const addressOf = (proxy: { host: string; port: number }) =>
  `${proxy.host}:${proxy.port}`;

@Injectable()
export class ProxyPoolSync {
  private readonly logger = new Logger(ProxyPoolSync.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ProxyPoolConfig,
    @Optional()
    @Inject(PROXY_PROVIDER_CLIENT)
    private readonly client: ProxyProviderClient | null,
  ) {}

  get enabled(): boolean {
    return this.client !== null;
  }

  get cron(): string {
    return this.config.syncCron;
  }

  async reconcile(): Promise<ProxyPoolSyncResult | null> {
    const client = this.client;
    if (!client) return null;

    const upstream = await client.list();
    if (upstream.length === 0) {
      this.logger.warn(
        `${client.provider} listed no proxies; keeping the pool as it is rather than retiring every endpoint`,
      );
      return null;
    }

    const result =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        'the proxy pool is operator infrastructure shared by every workspace',
        () => this.apply(client.provider, upstream),
      );
    this.logger.log(`proxy pool sync ${JSON.stringify(result)}`);
    return result;
  }

  private async apply(
    provider: string,
    upstream: UpstreamProxy[],
  ): Promise<ProxyPoolSyncResult> {
    const existing = await this.prisma.proxyEndpoint.findMany({
      where: { provider },
    });
    const byExternalId = new Map(existing.map((row) => [row.externalId, row]));
    const byAddress = new Map(existing.map((row) => [addressOf(row), row]));
    const matched = new Set<string>();
    let added = 0;
    let restored = 0;

    for (const proxy of upstream) {
      const current =
        byExternalId.get(proxy.externalId) ?? byAddress.get(addressOf(proxy));
      if (!current) {
        await this.create(provider, proxy);
        added++;
        continue;
      }
      matched.add(current.id);
      if (current.retiredAt) restored++;
      await this.adopt(current, proxy);
    }

    const retired = existing.filter(
      (row) => !matched.has(row.id) && row.retiredAt === null,
    );
    if (retired.length > 0) {
      await this.prisma.proxyEndpoint.updateMany({
        where: { id: { in: retired.map((row) => row.id) } },
        data: { enabled: false, retiredAt: new Date() },
      });
    }

    return {
      added,
      restored,
      retired: retired.length,
      total: upstream.length,
    };
  }

  private create(provider: string, proxy: UpstreamProxy) {
    return this.prisma.proxyEndpoint.create({
      data: {
        provider,
        externalId: proxy.externalId,
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        tier: proxy.tier,
        country: proxy.country ?? null,
        credentialRef: POOL_CREDENTIAL_REF,
        enabled: false,
      },
    });
  }

  private adopt(current: ProxyEndpoint, proxy: UpstreamProxy) {
    return this.prisma.proxyEndpoint.update({
      where: { id: current.id },
      data: {
        externalId: proxy.externalId,
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        tier: proxy.tier,
        country: proxy.country ?? null,
        retiredAt: null,
      },
    });
  }
}
