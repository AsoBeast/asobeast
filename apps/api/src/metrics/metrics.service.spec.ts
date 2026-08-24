import { ConfigService } from '@nestjs/config';
import { IsolationMonitor } from '../common/tenancy/isolation-monitor.service';
import { InstanceMetricsCollector } from './instance-metrics.service';
import { instanceMetricsOf } from './metrics.fixture';
import { MetricsService } from './metrics.service';
import { WorkspaceMetricsCollector } from './workspace-metrics.service';

const NOW = new Date('2026-08-18T12:00:00.000Z');

describe('MetricsService caching', () => {
  function serviceWith(cacheSeconds: number) {
    const workspaces = { collect: jest.fn().mockResolvedValue([]) };
    const instance = {
      collect: jest.fn().mockResolvedValue(instanceMetricsOf()),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'METRICS_CACHE_SECONDS' ? cacheSeconds : '0 3 * * *',
      ),
    };
    const service = new MetricsService(
      workspaces as unknown as WorkspaceMetricsCollector,
      instance as unknown as InstanceMetricsCollector,
      new IsolationMonitor(),
      config as unknown as ConfigService<never, true>,
    );
    return { service, workspaces, instance };
  }

  it('reuses one collection for scrapes inside the cache window', async () => {
    const { service, workspaces, instance } = serviceWith(30);

    await service.scrape(NOW);
    await service.scrape(new Date(NOW.getTime() + 29_000));

    expect(workspaces.collect).toHaveBeenCalledTimes(1);
    expect(instance.collect).toHaveBeenCalledTimes(1);
  });

  it('collects again once the cache window has passed', async () => {
    const { service, workspaces } = serviceWith(30);

    await service.scrape(NOW);
    await service.scrape(new Date(NOW.getTime() + 31_000));

    expect(workspaces.collect).toHaveBeenCalledTimes(2);
  });

  it('collects once for concurrent scrapes that race the first collection', async () => {
    const { service, workspaces } = serviceWith(30);

    await Promise.all([service.scrape(NOW), service.scrape(NOW)]);

    expect(workspaces.collect).toHaveBeenCalledTimes(1);
  });

  it('collects on every scrape when caching is switched off', async () => {
    const { service, workspaces } = serviceWith(0);

    await service.scrape(NOW);
    await service.scrape(NOW);

    expect(workspaces.collect).toHaveBeenCalledTimes(2);
  });
});
