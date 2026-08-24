import { Injectable, Logger } from '@nestjs/common';
import { ProxyOutcome, ProxyTier, Store } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-provider.registry';
import { EgressMeter, throughEgress } from './egress';
import {
  observed,
  outcomeOf,
  ProxyHealthTracker,
} from './proxy-health.service';
import { ProxyLedger } from './proxy-ledger.service';
import { ProxyPool } from './proxy-pool.service';

const PROBE_JUSTIFICATION =
  'probing a pool endpoint proves shared capacity, not one workspace';
const PROBE_STORE = Store.APP_STORE;
const PROBE_TERM = 'habit';
const PROBE_COUNTRY = 'us';
const PROBE_BATCH = 20;

export interface ProxyProbeResult {
  probed: number;
  enabled: number;
}

@Injectable()
export class ProxyProbe {
  private readonly logger = new Logger(ProxyProbe.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly pool: ProxyPool,
    private readonly registry: StoreProviderRegistry,
    private readonly health: ProxyHealthTracker,
    private readonly ledger: ProxyLedger,
  ) {}

  async admitPending(batch = PROBE_BATCH): Promise<ProxyProbeResult> {
    const pending =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        PROBE_JUSTIFICATION,
        () =>
          this.prisma.proxyEndpoint.findMany({
            where: { enabled: false, retiredAt: null },
            orderBy: { createdAt: 'asc' },
            take: batch,
            select: { id: true },
          }),
      );

    let enabled = 0;
    for (const endpoint of pending) {
      if (await this.probe(endpoint.id)) enabled++;
    }

    const result = { probed: pending.length, enabled };
    if (pending.length > 0) {
      this.logger.log(`proxy pool probe ${JSON.stringify(result)}`);
    }
    return result;
  }

  private async probe(endpointId: string): Promise<boolean> {
    const lease = await this.pool.leaseEndpoint(endpointId);
    if (!lease) return false;

    const meter = new EgressMeter(lease.dispatcher);
    try {
      await throughEgress(meter, () =>
        this.registry.get(PROBE_STORE).suggest(PROBE_TERM, PROBE_COUNTRY),
      );
    } catch (error) {
      const outcome = outcomeOf(error) ?? ProxyOutcome.TRANSPORT;
      await this.ledger.record(
        ProxyTier.DATACENTER,
        Math.max(meter.requests, 1),
      );
      await this.health.record(endpointId, PROBE_STORE, observed(outcome));
      return false;
    }

    await this.ledger.record(ProxyTier.DATACENTER, Math.max(meter.requests, 1));
    await this.health.record(
      endpointId,
      PROBE_STORE,
      observed(ProxyOutcome.SUCCESS),
    );
    await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      PROBE_JUSTIFICATION,
      () =>
        this.prisma.proxyEndpoint.update({
          where: { id: endpointId },
          data: { enabled: true },
        }),
    );
    return true;
  }
}
