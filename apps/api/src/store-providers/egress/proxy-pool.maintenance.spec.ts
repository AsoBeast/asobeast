import { ProxyPoolHealthReport } from './proxy-pool-health.service';
import { ProxyPoolMaintenance } from './proxy-pool.maintenance';
import { ProxyPoolSync } from './proxy-pool.sync';
import { ProxyProbe } from './proxy-probe.service';

describe('ProxyPoolMaintenance', () => {
  const reconcile = jest.fn<Promise<null>, []>();
  const admitPending = jest.fn<Promise<{ probed: number }>, []>();
  const build = jest.fn<Promise<{ alerts: string[] }>, []>();

  const maintenanceWith = (enabled: boolean) =>
    new ProxyPoolMaintenance(
      { enabled, cron: '0 * * * *', reconcile } as unknown as ProxyPoolSync,
      { admitPending } as unknown as ProxyProbe,
      { build } as unknown as ProxyPoolHealthReport,
    );

  beforeEach(() => {
    reconcile.mockReset().mockResolvedValue(null);
    admitPending.mockReset().mockResolvedValue({ probed: 0 });
    build.mockReset().mockResolvedValue({ alerts: [] });
  });

  it('reconciles and probes a fresh pool before any store work waits on it', async () => {
    const maintenance = maintenanceWith(true);

    await maintenance.ensureInitialized();

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(admitPending).toHaveBeenCalledTimes(1);
  });

  it('initializes the pool once however many jobs ask for it at the same time', async () => {
    const maintenance = maintenanceWith(true);

    await Promise.all([
      maintenance.ensureInitialized(),
      maintenance.ensureInitialized(),
      maintenance.ensureInitialized(),
    ]);

    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('starts the pool at boot rather than waiting for the sync cron', async () => {
    const maintenance = maintenanceWith(true);

    maintenance.onApplicationBootstrap();
    await maintenance.ensureInitialized();

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(admitPending).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all when no proxy provider is configured', async () => {
    const maintenance = maintenanceWith(false);

    maintenance.onApplicationBootstrap();
    await maintenance.ensureInitialized();
    await maintenance.run();

    expect(reconcile).not.toHaveBeenCalled();
    expect(admitPending).not.toHaveBeenCalled();
  });

  it('lets the next job retry an initialization the provider refused', async () => {
    reconcile.mockRejectedValueOnce(new Error('webshare is down'));
    const maintenance = maintenanceWith(true);

    await expect(maintenance.ensureInitialized()).resolves.toBeUndefined();
    await maintenance.ensureInitialized();

    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it('treats a completed cron run as the initialization', async () => {
    const maintenance = maintenanceWith(true);

    await maintenance.run();
    await maintenance.ensureInitialized();

    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});
