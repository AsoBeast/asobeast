import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { Env } from '../config/env';
import { PoolCapacity } from '../store-providers/egress/pool-capacity.service';
import { ProxyPoolConfig } from '../store-providers/egress/proxy-pool.config';

const MINUTES_PER_DAY = 60 * 24;

@Injectable()
export class DailyCapacity {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly pool: ProxyPoolConfig,
    private readonly poolCapacity: PoolCapacity,
  ) {}

  async perDay(store: Store): Promise<number> {
    if (!this.pool.enabled) {
      return this.hostRpm(store) * MINUTES_PER_DAY;
    }
    const healthy = await this.poolCapacity.healthy(store);
    return healthy * this.pool.endpointRpm * MINUTES_PER_DAY;
  }

  private hostRpm(store: Store): number {
    return store === Store.GOOGLE_PLAY
      ? this.config.get('SCRAPE_GPLAY_RPM', { infer: true })
      : this.config.get('SCRAPE_ITUNES_RPM', { infer: true });
  }
}
