import {
  AppStoreLocalization,
  nativeLocalizations,
  readLocalizations,
} from '@asobeast/shared';

export const additionalLocalizations = (
  market: string,
): readonly AppStoreLocalization[] => readLocalizations(market).slice(1);

export function capturedLocalizations(
  market: string,
  shipped: readonly string[],
): AppStoreLocalization[] {
  const captured = new Set<string>([
    ...nativeLocalizations(market),
    ...shipped,
  ]);
  return additionalLocalizations(market).filter((localization) =>
    captured.has(localization),
  );
}
