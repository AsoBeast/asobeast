export const ONBOARDING_STORAGE_KEY = "asobeast:onboarding";
export const ONBOARDING_VERSION = 1 as const;
export const ONBOARDING_CHANGE_EVENT = "asobeast:onboarding-change";

export type OnboardingStatus =
  "not_started" | "in_progress" | "completed" | "dismissed";

export interface OnboardingAcknowledgements {
  noCompetitors: boolean;
  keywordsConfirmed: boolean;
  capacityReviewed: boolean;
  alertsSkipped: boolean;
}

export interface OnboardingState {
  version: typeof ONBOARDING_VERSION;
  status: OnboardingStatus;
  appId: string | null;
  selectedMarkets: string[];
  acknowledgements: OnboardingAcknowledgements;
}

export interface OnboardingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const NOT_STARTED_ONBOARDING: OnboardingState = {
  version: ONBOARDING_VERSION,
  status: "not_started",
  appId: null,
  selectedMarkets: [],
  acknowledgements: {
    noCompetitors: false,
    keywordsConfirmed: false,
    capacityReviewed: false,
    alertsSkipped: false,
  },
};

const STATUSES: OnboardingStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "dismissed",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStatus = (value: unknown): value is OnboardingStatus =>
  typeof value === "string" && STATUSES.includes(value as OnboardingStatus);

const areMarkets = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every(
    (market) =>
      typeof market === "string" && normalizeMarket(market) === market,
  ) &&
  new Set(value).size === value.length;

const areAcknowledgements = (
  value: unknown,
): value is OnboardingAcknowledgements =>
  isRecord(value) &&
  typeof value.noCompetitors === "boolean" &&
  typeof value.keywordsConfirmed === "boolean" &&
  typeof value.capacityReviewed === "boolean" &&
  typeof value.alertsSkipped === "boolean";

function hasValidLifecycle(
  status: OnboardingStatus,
  appId: string | null,
  markets: string[],
): boolean {
  return status === "not_started"
    ? appId === null && markets.length === 0
    : Boolean(appId) && markets.length > 0;
}

export const normalizeMarket = (value: string): string | null => {
  const market = value.trim().toLowerCase();
  return /^[a-z]{2}$/.test(market) ? market : null;
};

export function parseOnboardingState(value: string | null): OnboardingState {
  if (!value) return NOT_STARTED_ONBOARDING;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== ONBOARDING_VERSION) {
      return NOT_STARTED_ONBOARDING;
    }
    const status = parsed.status;
    const appId = parsed.appId;
    const selectedMarkets = parsed.selectedMarkets;
    const acknowledgements = parsed.acknowledgements;
    if (
      !isStatus(status) ||
      (appId !== null && typeof appId !== "string") ||
      !areMarkets(selectedMarkets) ||
      !areAcknowledgements(acknowledgements) ||
      !hasValidLifecycle(status, appId, selectedMarkets)
    ) {
      return NOT_STARTED_ONBOARDING;
    }
    return {
      version: ONBOARDING_VERSION,
      status,
      appId,
      selectedMarkets,
      acknowledgements: {
        noCompetitors: acknowledgements.noCompetitors,
        keywordsConfirmed: acknowledgements.keywordsConfirmed,
        capacityReviewed: acknowledgements.capacityReviewed,
        alertsSkipped: acknowledgements.alertsSkipped,
      },
    };
  } catch {
    return NOT_STARTED_ONBOARDING;
  }
}

export function readOnboardingState(
  storage?: OnboardingStorage,
): OnboardingState {
  try {
    const target = storage ?? window.localStorage;
    return parseOnboardingState(target.getItem(ONBOARDING_STORAGE_KEY));
  } catch {
    return NOT_STARTED_ONBOARDING;
  }
}

export function writeOnboardingState(
  state: OnboardingState,
  storage?: OnboardingStorage,
): boolean {
  try {
    const target = storage ?? window.localStorage;
    target.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

let volatileSnapshot: string | null = null;
let preferVolatileSnapshot = false;

export function getOnboardingSnapshot(): string | null {
  if (preferVolatileSnapshot) return volatileSnapshot;
  try {
    return (
      window.localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? volatileSnapshot
    );
  } catch {
    return volatileSnapshot;
  }
}

export const getServerOnboardingSnapshot = (): null => null;

export function subscribeOnboarding(onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === ONBOARDING_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(ONBOARDING_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ONBOARDING_CHANGE_EVENT, onChange);
  };
}

export function saveOnboardingState(state: OnboardingState): void {
  volatileSnapshot = JSON.stringify(state);
  preferVolatileSnapshot = !writeOnboardingState(state);
  try {
    window.dispatchEvent(new Event(ONBOARDING_CHANGE_EVENT));
  } catch {
    return;
  }
}

export function startOnboardingAfterImport(
  appId: string,
  homeMarket: string,
): boolean {
  const current = parseOnboardingState(getOnboardingSnapshot());
  const next = beginOnboarding(current, appId, homeMarket);
  if (next === current) return false;
  saveOnboardingState(next);
  return true;
}

export function navigateToOnboarding(
  appId: string,
  navigate: (path: string) => void,
): boolean {
  try {
    navigate(`/apps/${appId}/setup`);
    return true;
  } catch {
    return false;
  }
}

export function beginOnboarding(
  state: OnboardingState,
  appId: string,
  homeMarket: string,
): OnboardingState {
  const market = normalizeMarket(homeMarket);
  if (state.status !== "not_started" || !appId || !market) return state;
  return {
    ...NOT_STARTED_ONBOARDING,
    status: "in_progress",
    appId,
    selectedMarkets: [market],
  };
}

export const restartOnboarding = (
  appId: string,
  homeMarket: string,
): OnboardingState =>
  beginOnboarding(NOT_STARTED_ONBOARDING, appId, homeMarket);

export function setMarketSelected(
  state: OnboardingState,
  value: string,
  selected: boolean,
): OnboardingState {
  const market = normalizeMarket(value);
  if (state.status !== "in_progress" || !market) return state;
  const markets = new Set(state.selectedMarkets);
  if (selected) markets.add(market);
  else if (markets.size > 1) markets.delete(market);
  return { ...state, selectedMarkets: [...markets].sort() };
}

export function setOnboardingAcknowledgement(
  state: OnboardingState,
  key: keyof OnboardingAcknowledgements,
  value: boolean,
): OnboardingState {
  if (state.status !== "in_progress") return state;
  return {
    ...state,
    acknowledgements: { ...state.acknowledgements, [key]: value },
  };
}

export function canCompleteOnboarding(
  state: OnboardingState,
  competitorCount: number,
  alertCount: number,
): boolean {
  const ready = state.acknowledgements;
  return (
    state.status === "in_progress" &&
    state.selectedMarkets.length > 0 &&
    (competitorCount > 0 || ready.noCompetitors) &&
    ready.keywordsConfirmed &&
    ready.capacityReviewed &&
    (alertCount > 0 || ready.alertsSkipped)
  );
}

export function completeOnboarding(
  state: OnboardingState,
  competitorCount: number,
  alertCount: number,
): OnboardingState {
  return canCompleteOnboarding(state, competitorCount, alertCount)
    ? { ...state, status: "completed" }
    : state;
}

export const dismissOnboarding = (state: OnboardingState): OnboardingState =>
  state.status === "in_progress" ? { ...state, status: "dismissed" } : state;
