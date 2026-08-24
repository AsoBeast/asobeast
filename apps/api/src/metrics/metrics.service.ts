import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsolationMonitor } from '../common/tenancy/isolation-monitor.service';
import { Env } from '../config/env';
import { previousDailyRun } from '../jobs/daily-schedule';
import { InstanceMetricsCollector } from './instance-metrics.service';
import { alertFamily, metricFamilies } from './metric-families';
import { operatorAlerts, type OperatorAlert } from './operator-alerts';
import { renderMetrics } from './prometheus';
import { WorkspaceMetricsCollector } from './workspace-metrics.service';

const HOUR_MS = 3_600_000;

interface CachedScrape {
  text: string;
  freshUntil: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private cached: CachedScrape | null = null;
  private inFlight: Promise<string> | null = null;

  constructor(
    private readonly workspaces: WorkspaceMetricsCollector,
    private readonly instance: InstanceMetricsCollector,
    private readonly isolation: IsolationMonitor,
    private readonly config: ConfigService<Env, true>,
  ) {}

  scrape(now = new Date()): Promise<string> {
    const ttl = this.config.get('METRICS_CACHE_SECONDS', { infer: true });
    if (ttl === 0) return this.collect(now);
    if (this.cached && now.getTime() < this.cached.freshUntil) {
      return Promise.resolve(this.cached.text);
    }
    this.inFlight ??= this.collect(now)
      .then((text) => {
        this.cached = { text, freshUntil: now.getTime() + ttl * 1000 };
        return text;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  private async collect(now: Date): Promise<string> {
    const [workspaces, instance] = await Promise.all([
      this.workspaces.collect(now),
      this.instance.collect(now),
    ]);
    const alerts = operatorAlerts({
      workspaces,
      instance,
      isolationAnomalies: this.isolation.anomalies,
      redisAvailable: instance.redisAvailable,
      hoursSinceTrigger: this.hoursSinceTrigger(now),
      hoursSinceBackup: hoursSince(instance.backup.lastCompletedAt, now),
    });
    this.announce(alerts);

    return renderMetrics([
      ...metricFamilies(workspaces, instance),
      ...alertFamily(alerts, this.isolation.anomalies),
    ]);
  }

  private hoursSinceTrigger(now: Date): number {
    const trigger = previousDailyRun(
      this.config.get('CRON_DAILY', { infer: true }),
      now,
    );
    return trigger === null ? 0 : (now.getTime() - trigger.getTime()) / HOUR_MS;
  }

  private announce(alerts: readonly OperatorAlert[]): void {
    for (const alert of alerts) {
      const line = alert.workspaceId
        ? `${alert.id} ${alert.workspaceId}: ${alert.summary}`
        : `${alert.id}: ${alert.summary}`;
      if (alert.severity === 'page') this.logger.error(line);
      else if (alert.severity === 'investigate') this.logger.warn(line);
      else this.logger.log(line);
    }
  }
}

function hoursSince(at: Date | null, now: Date): number | null {
  return at === null ? null : (now.getTime() - at.getTime()) / HOUR_MS;
}
