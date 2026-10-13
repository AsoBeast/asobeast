import {
  AppStoreLocalization,
  nativeLocalizations,
  readLocalizations,
} from '@asobeast/shared';

export function capturedLocalizations(
  market: string,
  shipped: readonly string[],
): AppStoreLocalization[] {
  const captured = new Set<string>([
    ...nativeLocalizations(market),
    ...shipped,
  ]);
  return readLocalizations(market)
    .slice(1)
    .filter((localization) => captured.has(localization));
}
