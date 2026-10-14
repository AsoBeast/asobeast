import { Store } from '@prisma/client';
import { capturedLocalizations } from '../apps/market-localizations';

export function localizationReads(
  targets: readonly { id: string; store: Store; country: string }[],
  shipped: ReadonlyMap<string, readonly string[]>,
): number {
  return targets.reduce(
    (total, target) =>
      total +
      (target.store === Store.APP_STORE
        ? capturedLocalizations(target.country, shipped.get(target.id) ?? [])
            .length
        : 0),
    0,
  );
}
