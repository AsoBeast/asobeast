import { Store } from '@prisma/client';
import { nativeLocalizations } from '@asobeast/shared';

export function localizationReads(
  targets: readonly { store: Store; country: string }[],
): number {
  return targets.reduce(
    (total, target) =>
      total +
      (target.store === Store.APP_STORE
        ? nativeLocalizations(target.country).length
        : 0),
    0,
  );
}
