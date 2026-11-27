import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProxyOutcome, ProxyTier, Store } from '@prisma/client';
import { storeDeadlineEndsAt, storeDeadlinePassed } from '../store-deadline';
import {
  currentEgress,
  EgressMeter,
  installEgressFetch,
  throughEgress,
} from './egress';
import {
  HealthObservation,
  isAccountRefusal,
  outcomeOf,
  ProxyHealthTracker,
  refusedStatusOf,
  TUNNEL_REFUSAL_COOLDOWN_MS,
} from './proxy-health.service';
import { ProxyLedger } from './proxy-ledger.service';
import { worstOutcome } from './proxy-outcome';
import { ProxyPoolConfig } from './proxy-pool.config';
import { ProxyPoolMaintenance } from './proxy-pool.maintenance';
import {
  ProxyAccountRefusedError,
  ProxyLease,
  ProxyPool,
} from './proxy-pool.service';
import { ResidentialFallback } from './residential-fallback.service';

const BURNT: ProxyOutcome[] = [ProxyOutcome.BLOCKED, ProxyOutcome.SILENT];

export interface EgressRoute {
  waitForLocal?: boolean;
}

export const ANY_FREE_ENDPOINT: EgressRoute = { waitForLocal: false };

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
    { waitForLocal = true }: EgressRoute = {},
  ): Promise<T> {
    if (currentEgress()) return work();

    await this.maintenance.ensureInitialized();
    const lease = await this.pool.acquire(store, country, waitForLocal);
    if (!lease) return work();

    const meter = new EgressMeter(lease.dispatcher);
    let result: T;
    try {
      result = await throughEgress(meter, work);
    } catch (error) {
      const outcome = await this.settle(lease, store, meter, error);
      if (outcome && BURNT.includes(outcome)) {
        return this.retryResidential(store, work, { outcome, error });
      }
      throw queuedRefusalOf(store, outcome, error) ?? error;
    }
    await this.settle(lease, store, meter, null);
    return result;
  }

  private async settle(
    lease: ProxyLease,
    store: Store,
    meter: EgressMeter,
    thrown: unknown,
  ): Promise<ProxyOutcome | null> {
    const observation = observe(meter, thrown);
    const unjudged =
      thrown !== null &&
      (observation.outcome === null || storeDeadlinePassed());
    try {
      await this.record(lease, store, meter, observation, unjudged);
    } catch (error) {
      this.logger.warn(
        `could not record the outcome of endpoint ${lease.endpointId}: ${String(error)}`,
      );
    }
    return unjudged ? null : observation.outcome;
  }

  private async record(
    { endpointId, leasedAt }: ProxyLease,
    store: Store,
    meter: EgressMeter,
    observation: EgressObservation,
    unjudged: boolean,
  ): Promise<void> {
    const pacing = {
      leasedAt,
      until: this.pacedUntil(leasedAt, meter, observation),
    };
    if (unjudged) {
      await this.pool.release(endpointId, store, pacing);
    } else {
      await this.health.record(endpointId, store, {
        successes: observation.successes,
        failures: observation.failures,
        outcome: observation.outcome ?? ProxyOutcome.SUCCESS,
        pacing,
        refusedStatus: observation.refusedStatus,
      });
    }
    await this.ledger.record(ProxyTier.DATACENTER, observation.requests);
  }

  private pacedUntil(
    leasedAt: Date,
    meter: EgressMeter,
    { requests }: EgressObservation,
  ): Date {
    const interval = this.config.minIntervalMs;
    const lastRequestAt = meter.lastRequestAt ?? leasedAt.getTime();
    return new Date(
      Math.max(
        leasedAt.getTime() + requests * interval,
        lastRequestAt + interval,
      ),
    );
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

function queuedRefusalOf(
  store: Store,
  outcome: ProxyOutcome | null,
  thrown: unknown,
): ProxyAccountRefusedError | null {
  const ending = { outcome, refusedStatus: refusedStatusOf(thrown) };
  if (storeDeadlineEndsAt() !== null || !isAccountRefusal(ending)) return null;
  return new ProxyAccountRefusedError(
    store,
    ending.refusedStatus,
    TUNNEL_REFUSAL_COOLDOWN_MS,
    { cause: thrown },
  );
}

interface EgressObservation extends Omit<HealthObservation, 'outcome'> {
  requests: number;
  outcome: ProxyOutcome | null;
}

function pureRefusalOf(failures: readonly unknown[]): number | undefined {
  const judged = failures.filter((failure) => outcomeOf(failure) !== null);
  const statuses = judged.map(refusedStatusOf);
  if (statuses.length === 0 || statuses.includes(undefined)) return undefined;
  return statuses.at(-1);
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
    refusedStatus: pureRefusalOf(
      thrownOutcome === null ? meter.failures : [...meter.failures, thrown],
    ),
    outcome: worstOutcome(
      thrownOutcome === null ? refused : [...refused, thrownOutcome],
    ),
  };
}
