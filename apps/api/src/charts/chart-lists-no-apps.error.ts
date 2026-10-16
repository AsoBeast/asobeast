import type { ChartKey } from '@asobeast/shared';

export class ChartListsNoAppsError extends Error {
  constructor(readonly key: ChartKey) {
    super(
      `${key.store} lists no apps in ${key.collection} ${key.genre} ${key.country}`,
    );
    this.name = 'ChartListsNoAppsError';
  }
}
