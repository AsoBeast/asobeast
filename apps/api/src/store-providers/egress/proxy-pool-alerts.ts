import {
  ProxyPoolAlert,
  ProxyStoreHealth,
  ResidentialFallbackHealth,
} from '@asobeast/shared';

export const HEALTHY_POOL_MIN_RATIO = 0.5;
export const BLOCKED_SHARE_ALERT = 0.1;
export const SILENT_SHARE_ALERT = 0.01;
export const RESIDENTIAL_CAP_WARN_RATIO = 0.8;

export function poolAlerts(input: {
  stores: ProxyStoreHealth[];
  residential: ResidentialFallbackHealth;
}): ProxyPoolAlert[] {
  const alerts = new Set<ProxyPoolAlert>();

  for (const store of input.stores) {
    if (store.endpoints === 0) continue;
    if (store.healthy / store.endpoints < HEALTHY_POOL_MIN_RATIO) {
      alerts.add('pool.healthy.low');
    }
    if (share(store, 'BLOCKED') >= BLOCKED_SHARE_ALERT) {
      alerts.add('pool.blocked.rising');
    }
    if (share(store, 'SILENT') >= SILENT_SHARE_ALERT) {
      alerts.add('pool.silent.rising');
    }
  }

  const { spendUsd, capUsd } = input.residential;
  if (capUsd > 0 && spendUsd / capUsd >= RESIDENTIAL_CAP_WARN_RATIO) {
    alerts.add('residential.spend.near-cap');
  }

  return [...alerts];
}

function share(store: ProxyStoreHealth, outcome: 'BLOCKED' | 'SILENT'): number {
  return store.endpoints === 0 ? 0 : store.outcomes[outcome] / store.endpoints;
}
