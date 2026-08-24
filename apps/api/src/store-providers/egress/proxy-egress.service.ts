import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProxyOutcome, ProxyTier, Store } from '@prisma/client';
import {
  currentEgress,
  EgressMeter,
  installEgressFetch,
  throughEgress,
} from './egress';
import {
  HealthObservation,
  outcomeOf,
  ProxyHealthTracker,
} from './proxy-health.service';
import { ProxyLedger } from './proxy-ledger.service';
import { worstOutcome } from './proxy-outcome';
import { ProxyPoolConfig } from './proxy-pool.config';
import { ProxyPoolMaintenance } from './proxy-pool.maintenance';
import { ProxyPool } from './proxy-pool.service';
import { ResidentialFallback } from './residential-fallback.service';

const BURNT: ProxyOutcome[] = [ProxyOutcome.BLOCKED, ProxyOutcome.SILENT];

@Injectable()
export class ProxyEgress implements OnModuleInit {
  private readonly logger = new Logger(ProxyEgress.name);

  constructor(
    private readonly pool: ProxyPool,
    private readonly config: ProxyPoolConfig,
    private readonly health: ProxyHealthTracker,
    private readonly residential: ResidentialFallback,
    private readonly ledger: ProxyLedger,
    private readonly maintenance: ProxyPoolMaintenance,
  ) {}

  onModuleInit(): void {
    if (this.config.enabled) installEgressFetch();
  }

  async through<T>(
    store: Store,
    country: string | undefined,
    work: () => Promise<T>,
  ): Promise<T> {
    if (currentEgress()) return work();

    await this.maintenance.ensureInitialized();
    const lease = await this.pool.acquire(store, country);
    if (!lease) return work();

    const meter = new EgressMeter(lease.dispatcher);
    try {
      const result = await throughEgress(meter, work);
      await this.settle(lease.endpointId, store, meter, null);
      return result;
    } catch (error) {
      const outcome = await this.settle(lease.endpointId, store, meter, error);
      if (outcome && BURNT.includes(outcome)) {
        return this.retryResidential(store, work, { outcome, error });
      }
      throw error;
    }
  }

  private async settle(
    endpointId: string,
    store: Store,
    meter: EgressMeter,
    thrown: unknown,
  ): Promise<ProxyOutcome | null> {
    const observation = observe(meter, thrown);
    await this.ledger.record(ProxyTier.DATACENTER, observation.requests);
    if (thrown !== null && observation.outcome === null) return null;

    await this.health.record(endpointId, store, {
      successes: observation.successes,
      failures: observation.failures,
      outcome: observation.outcome ?? ProxyOutcome.SUCCESS,
      pacedUntil: new Date(
        Date.now() +
          Math.max(observation.requests - 1, 0) * this.config.minIntervalMs,
      ),
    });
    return observation.outcome;
  }

  private async retryResidential<T>(
    store: Store,
    work: () => Promise<T>,
    burnt: { outcome: ProxyOutcome; error: unknown },
  ): Promise<T> {
    const dispatcher = await this.residential.claim();
    if (!dispatcher) throw burnt.error;

    this.logger.warn(
      `falling back to residential egress for ${store} after ${burnt.outcome}`,
    );
    const meter = new EgressMeter(dispatcher, () => this.residential.admit());
    return throughEgress(meter, work);
  }
}

interface EgressObservation extends Omit<HealthObservation, 'outcome'> {
  requests: number;
  outcome: ProxyOutcome | null;
}

function observe(meter: EgressMeter, thrown: unknown): EgressObservation {
  const requests = Math.max(meter.requests, 1);
  const refused = meter.failures
    .map(outcomeOf)
    .filter((outcome): outcome is ProxyOutcome => outcome !== null);
  const thrownOutcome = thrown === null ? null : outcomeOf(thrown);
  const failures = Math.min(
    Math.max(refused.length, thrownOutcome === null ? 0 : 1),
    requests,
  );

  return {
    requests,
    successes: requests - failures,
    failures,
    outcome: worstOutcome(
      thrownOutcome === null ? refused : [...refused, thrownOutcome],
    ),
  };
}
