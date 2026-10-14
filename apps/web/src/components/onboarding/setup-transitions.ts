import {
  SETUP_STEPS,
  type AppSetupState,
  type AppSetupUpdateRequest,
  type SetupStep,
} from "@asobeast/shared";

export type SetupTransition = (
  current: AppSetupState,
) => AppSetupUpdateRequest | null;

const normalizeMarket = (value: string): string | null => {
  const market = value.trim().toLowerCase();
  return /^[a-z]{2}$/.test(market) ? market : null;
};

const whileInProgress =
  (transition: SetupTransition): SetupTransition =>
  (current) =>
    current.status === "in_progress" ? transition(current) : null;

export const beginSetup =
  (home: string): SetupTransition =>
  () => {
    const market = normalizeMarket(home);
    return market
      ? {
          status: "in_progress",
          skipped: [],
          countriesReviewed: false,
          selectedMarkets: [market],
        }
      : null;
  };

export const skipStep = (step: SetupStep, skipped: boolean): SetupTransition =>
  whileInProgress((current) => {
    const steps = new Set(current.skipped);
    if (skipped) steps.add(step);
    else steps.delete(step);
    return { skipped: SETUP_STEPS.filter((name) => steps.has(name)) };
  });

export const reviewCountries = (): SetupTransition =>
  whileInProgress((current) =>
    current.countriesReviewed ? null : { countriesReviewed: true },
  );

export const selectMarket = (
  value: string,
  selected: boolean,
): SetupTransition =>
  whileInProgress((current) => {
    const market = normalizeMarket(value);
    if (!market) return null;
    const markets = new Set(current.selectedMarkets);
    if (selected) markets.add(market);
    else if (markets.size > 1) markets.delete(market);
    if (markets.size === current.selectedMarkets.length) return null;
    return { selectedMarkets: [...markets].sort(), countriesReviewed: true };
  });

export const completeSetup = (): SetupTransition =>
  whileInProgress(() => ({ status: "completed" }));

export const dismissSetup = (): SetupTransition =>
  whileInProgress(() => ({ status: "dismissed" }));

export function applySetupPatch(
  current: AppSetupState,
  patch: AppSetupUpdateRequest,
  now: Date,
): AppSetupState {
  const next = { ...current, ...patch, updatedAt: now.toISOString() };
  if (patch.status === undefined) return next;
  return {
    ...next,
    completedAt:
      patch.status === "completed"
        ? (current.completedAt ?? now.toISOString())
        : null,
  };
}
