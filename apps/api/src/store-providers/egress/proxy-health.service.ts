import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProxyOutcome, Store } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { ImplausibleResultError, StoreRequestError } from '../errors';
import { classifyFailure, cooldownMs } from './proxy-outcome';
import { ProxyPoolUnavailableError } from './proxy-pool.service';

const HEALTH_JUSTIFICATION =
  'endpoint health belongs to the shared pool, not to the workspace whose job observed it';

export const HEALTH_WINDOW_MS = 60 * 60_000;

export interface HealthObservation {
  successes: number;
  failures: number;
  outcome: ProxyOutcome;
  pacedUntil?: Date;
}

export function observed(outcome: ProxyOutcome): HealthObservation {
  const failed = outcome !== ProxyOutcome.SUCCESS;
  return { successes: failed ? 0 : 1, failures: failed ? 1 : 0, outcome };
}

interface HealthWindow {
  successes: number;
  failures: number;
  windowStartedAt: Date;
}

function rollWindow(current: HealthWindow | null, now: Date): HealthWindow {
  if (
    !current ||
    now.getTime() - current.windowStartedAt.getTime() >= HEALTH_WINDOW_MS
  ) {
    return { successes: 0, failures: 0, windowStartedAt: now };
  }
  return {
    successes: current.successes,
    failures: current.failures,
    windowStartedAt: current.windowStartedAt,
  };
}

export function outcomeOf(error: unknown): ProxyOutcome | null {
  if (error instanceof ImplausibleResultError) return ProxyOutcome.SILENT;
  if (error instanceof ProxyPoolUnavailableError) return null;
  if (error instanceof StoreRequestError) {
    return classifyFailure(error.causeMessage);
  }
  return error instanceof Error ? classifyFailure(error.message) : null;
}

@Injectable()
export class ProxyHealthTracker {
  private readonly logger = new Logger(ProxyHealthTracker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  record(
    endpointId: string,
    store: Store,
    observation: HealthObservation,
  ): Promise<void> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      HEALTH_JUSTIFICATION,
      () => this.write(endpointId, store, observation),
    );
  }

  private async write(
    endpointId: string,
    store: Store,
    observation: HealthObservation,
  ): Promise<void> {
    const now = new Date();
    const current = await this.prisma.proxyHealth.findUnique({
      where: { endpointId_store: { endpointId, store } },
      select: {
        successes: true,
        failures: true,
        consecutiveFailures: true,
        windowStartedAt: true,
      },
    });
    const window = rollWindow(current, now);
    const paced =
      observation.pacedUntil === undefined
        ? {}
        : { pacedUntil: observation.pacedUntil };
    const counted = {
      ...window,
      successes: window.successes + observation.successes,
      failures: window.failures + observation.failures,
      ...(observation.successes > 0 ? { lastSuccessAt: now } : {}),
      lastOutcome: observation.outcome,
      ...paced,
    };

    if (observation.outcome === ProxyOutcome.SUCCESS) {
      await this.upsert(endpointId, store, {
        ...counted,
        consecutiveFailures: 0,
        cooldownUntil: null,
      });
      return;
    }

    const consecutiveFailures = (current?.consecutiveFailures ?? 0) + 1;
    const cooldownUntil = new Date(
      now.getTime() + cooldownMs(observation.outcome, consecutiveFailures),
    );
    await this.upsert(endpointId, store, {
      ...counted,
      consecutiveFailures,
      cooldownUntil,
      lastFailureAt: now,
    });

    this.logger.warn(
      `endpoint ${endpointId} ${store} ${observation.outcome} #${consecutiveFailures} after ${observation.successes} ok and ${observation.failures} refused, cooling down until ${cooldownUntil.toISOString()}`,
    );
  }

  private async upsert(
    endpointId: string,
    store: Store,
    data: Prisma.ProxyHealthUncheckedUpdateInput,
  ): Promise<void> {
    await this.prisma.proxyHealth.upsert({
      where: { endpointId_store: { endpointId, store } },
      create: {
        endpointId,
        store,
        ...data,
      } as Prisma.ProxyHealthUncheckedCreateInput,
      update: data,
    });
  }
}
