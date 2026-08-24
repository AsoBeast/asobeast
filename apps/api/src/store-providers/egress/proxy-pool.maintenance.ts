import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ProxyPoolHealthReport } from './proxy-pool-health.service';
import { ProxyPoolSync } from './proxy-pool.sync';
import { ProxyProbe } from './proxy-probe.service';

@Injectable()
export class ProxyPoolMaintenance implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProxyPoolMaintenance.name);
  private initialized: Promise<void> | null = null;

  constructor(
    private readonly sync: ProxyPoolSync,
    private readonly probe: ProxyProbe,
    private readonly report: ProxyPoolHealthReport,
  ) {}

  get enabled(): boolean {
    return this.sync.enabled;
  }

  get cron(): string {
    return this.sync.cron;
  }

  onApplicationBootstrap(): void {
    void this.ensureInitialized();
  }

  ensureInitialized(): Promise<void> {
    if (!this.enabled) return Promise.resolve();
    this.initialized ??= this.firstRun();
    return this.initialized;
  }

  async run(): Promise<void> {
    if (!this.enabled) return;
    await this.refresh();
    this.initialized ??= Promise.resolve();
    await this.raiseAlerts();
  }

  private async firstRun(): Promise<void> {
    try {
      await this.refresh();
    } catch (error) {
      this.initialized = null;
      this.logger.error(
        `proxy pool initialization failed, store work will retry it: ${String(error)}`,
      );
    }
  }

  private async refresh(): Promise<void> {
    await this.sync.reconcile();
    await this.probe.admitPending();
  }

  private async raiseAlerts(): Promise<void> {
    const health = await this.report.build();
    if (health.alerts.length === 0) return;
    this.logger.error(
      `proxy pool ${JSON.stringify({
        alerts: health.alerts,
        total: health.total,
        stores: health.stores.map((store) => ({
          store: store.store,
          healthy: store.healthy,
          coolingDown: store.coolingDown,
          outcomes: store.outcomes,
        })),
        residential: {
          spendUsd: health.residential.spendUsd,
          capUsd: health.residential.capUsd,
          fallbackRate: health.residential.fallbackRate,
        },
      })}`,
    );
  }
}
