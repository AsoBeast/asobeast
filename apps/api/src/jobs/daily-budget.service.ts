import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BudgetCompletion,
  BudgetQuota,
  DailyBudget,
  Store,
  STORES,
  StoreDailyBudget,
} from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { Env } from '../config/env';
import { DailyCapacity } from './daily-capacity.service';
import { completionHours, nextDailyRun } from './daily-schedule';
import { DailyTargets, DailyTargetsCollector } from './daily-targets.service';
import { OverLimitRegistry } from './over-limit.registry';
import { requestsFor } from './request-weights';

const HOUR_MS = 3_600_000;

@Injectable()
export class DailyBudgetService {
  constructor(
    private readonly targets: DailyTargetsCollector,
    private readonly categoryRanks: CategoryRanksService,
    private readonly capacity: DailyCapacity,
    private readonly quota: QuotaService,
    private readonly overLimit: OverLimitRegistry,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async estimate(): Promise<DailyBudget> {
    const targets = await this.targets.collect();
    const buckets = await this.categoryRanks.buckets(
      targets.apps.map((app) => app.id),
    );

    const stores = await Promise.all(
      STORES.map((store) => this.storeBudget(store, targets, buckets)),
    );
    const total = sum(stores, (store) => store.total);
    const capacityPerDay = sum(stores, (store) => store.capacityPerDay);

    return {
      apps: sum(stores, (store) => store.apps),
      keywords: sum(stores, (store) => store.keywords),
      categories: sum(stores, (store) => store.categories),
      reviews: sum(stores, (store) => store.reviews),
      total,
      capacityPerDay,
      utilization: Math.max(...stores.map((store) => store.utilization)),
      stores,
      quota: await this.budgetQuota(),
      completion: this.projectCompletion(stores),
    };
  }

  private async storeBudget(
    store: Store,
    targets: DailyTargets,
    buckets: { store: Store }[],
  ): Promise<StoreDailyBudget> {
    const apps = targets.apps.filter((app) => app.store === store).length;
    const keywords = targets.keywords.filter(
      (keyword) => keyword.store === store,
    ).length;
    const categories = buckets.filter(
      (bucket) => bucket.store === store,
    ).length;
    const reviews = targets.reviewApps.filter(
      (app) => app.store === store,
    ).length;
    const total = requestsFor(store, { apps, keywords, categories, reviews });
    const capacityPerDay = await this.capacity.perDay(store);

    return {
      store,
      apps,
      keywords,
      categories,
      reviews,
      total,
      capacityPerDay,
      utilization:
        capacityPerDay > 0
          ? Math.round((total / capacityPerDay) * 1000) / 1000
          : 0,
    };
  }

  private async budgetQuota(): Promise<BudgetQuota | null> {
    if (!this.quota.enforced) return null;
    const [usage, state] = await Promise.all([
      this.quota.usage(),
      this.overLimit.state(),
    ]);
    return {
      plan: usage.plan,
      apps: { used: usage.apps, limit: usage.limits.apps },
      keywordMarkets: {
        used: usage.keywordMarkets,
        limit: usage.limits.keywordMarkets,
      },
      overLimitSince: state.since?.toISOString() ?? null,
    };
  }

  private projectCompletion(stores: StoreDailyBudget[]): BudgetCompletion {
    const perStore = stores.map((store) =>
      completionHours(store.total, store.capacityPerDay),
    );
    const hours = perStore.every((store) => store !== null)
      ? Math.max(...perStore)
      : null;
    const startsAt = nextDailyRun(
      this.config.get('CRON_DAILY', { infer: true }),
      new Date(),
    );
    return {
      startsAt: startsAt?.toISOString() ?? null,
      completesAt:
        startsAt && hours !== null
          ? new Date(startsAt.getTime() + hours * HOUR_MS).toISOString()
          : null,
      hours,
    };
  }
}

function sum<T>(items: T[], select: (item: T) => number): number {
  return items.reduce((acc, item) => acc + select(item), 0);
}
