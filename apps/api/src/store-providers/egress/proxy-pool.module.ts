import { Global, Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers.module';
import { PoolCapacity } from './pool-capacity.service';
import { PoolShutdown } from './pool-shutdown';
import { ProxyEgress } from './proxy-egress.service';
import { ProxyHealthTracker } from './proxy-health.service';
import { ProxyLedger } from './proxy-ledger.service';
import { ProxyPoolHealthReport } from './proxy-pool-health.service';
import { ProxyPoolConfig } from './proxy-pool.config';
import { ProxyPoolController } from './proxy-pool.controller';
import { ProxyPoolMaintenance } from './proxy-pool.maintenance';
import { ProxyPool } from './proxy-pool.service';
import { ProxyPoolSync } from './proxy-pool.sync';
import { ProxyProbe } from './proxy-probe.service';
import { PROXY_PROVIDER_CLIENT, ProxyProviderClient } from './proxy-provider';
import { ResidentialFallback } from './residential-fallback.service';
import { WebshareClient } from './webshare.client';

@Global()
@Module({
  imports: [StoreProvidersModule],
  controllers: [ProxyPoolController],
  providers: [
    ProxyPoolConfig,
    PoolShutdown,
    ProxyLedger,
    ProxyPoolHealthReport,
    {
      provide: PROXY_PROVIDER_CLIENT,
      inject: [ProxyPoolConfig],
      useFactory: (config: ProxyPoolConfig): ProxyProviderClient | null =>
        config.provider === 'webshare' ? new WebshareClient(config) : null,
    },
    ProxyPool,
    PoolCapacity,
    ProxyHealthTracker,
    ResidentialFallback,
    ProxyEgress,
    ProxyPoolSync,
    ProxyProbe,
    ProxyPoolMaintenance,
  ],
  exports: [
    ProxyPoolConfig,
    ProxyLedger,
    ProxyPool,
    PoolCapacity,
    ProxyHealthTracker,
    ResidentialFallback,
    ProxyEgress,
    ProxyPoolMaintenance,
    ProxyPoolHealthReport,
  ],
})
export class ProxyPoolModule {}
