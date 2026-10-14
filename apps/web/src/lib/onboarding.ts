export const ONBOARDING_STORAGE_KEY = "asobeast:onboarding";
export const ONBOARDING_VERSION = 2 as const;
export const ONBOARDING_CHANGE_EVENT = "asobeast:onboarding-change";

const ACCOUNT_KEY_PREFIX = `${ONBOARDING_STORAGE_KEY}:`;

export const onboardingStorageKey = (account: string): string =>
  `${ACCOUNT_KEY_PREFIX}${account}`;

export const SETUP_STEPS = ["competitors", "keywords", "countries"] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

export const SETUP_COMPETITOR_TARGET = 1;
export const SETUP_KEYWORD_TARGET = 10;

type CountedStep = Exclude<SetupStep, "countries">;

export type SetupCounts = Record<CountedStep, number | null>;

export type StepState = "done" | "skipped" | "open" | "loading";

export interface StepProgress {
  done: number;
  total: number;
  next: SetupStep | null;
}

const STEP_TARGETS: Record<CountedStep, number> = {
  competitors: SETUP_COMPETITOR_TARGET,
  keywords: SETUP_KEYWORD_TARGET,
};

export function stepLabel(step: SetupStep): string {
  return `Step ${SETUP_STEPS.indexOf(step) + 1} of ${SETUP_STEPS.length}`;
}

export type OnboardingStatus =
  "not_started" | "in_progress" | "completed" | "dismissed";

export interface OnboardingState {
  version: typeof ONBOARDING_VERSION;
  status: OnboardingStatus;
  appId: string | null;
  selectedMarkets: string[];
  skipped: SetupStep[];
  countriesReviewed: boolean;
}

export interface OnboardingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const NOT_STARTED_ONBOARDING: OnboardingState = {
  version: ONBOARDING_VERSION,
  status: "not_started",
  appId: null,
  selectedMarkets: [],
  skipped: [],
  countriesReviewed: false,
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

const areVersionOneAcknowledgements = (
  value: unknown,
): value is { noCompetitors: boolean } =>
  isRecord(value) &&
  typeof value.noCompetitors === "boolean" &&
  typeof value.keywordsConfirmed === "boolean" &&
  typeof value.capacityReviewed === "boolean" &&
  typeof value.alertsSkipped === "boolean";

const areSkippedSteps = (value: unknown): value is SetupStep[] =>
  Array.isArray(value) &&
  value.every((step) => SETUP_STEPS.includes(step as SetupStep)) &&
  new Set(value).size === value.length;

const inStepOrder = (steps: readonly SetupStep[]): SetupStep[] =>
  SETUP_STEPS.filter((step) => steps.includes(step));

function stepsOfRecord(
  record: Record<string, unknown>,
): Pick<OnboardingState, "skipped" | "countriesReviewed"> | null {
  if (record.version === 1) {
    return areVersionOneAcknowledgements(record.acknowledgements)
      ? {
          skipped: record.acknowledgements.noCompetitors ? ["competitors"] : [],
          countriesReviewed: false,
        }
      : null;
  }
  if (record.version !== ONBOARDING_VERSION) return null;
  const { skipped, countriesReviewed } = record;
  return areSkippedSteps(skipped) && typeof countriesReviewed === "boolean"
    ? { skipped: inStepOrder(skipped), countriesReviewed }
    : null;
}

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
    if (!isRecord(parsed)) return NOT_STARTED_ONBOARDING;
    const steps = stepsOfRecord(parsed);
    const { status, appId, selectedMarkets } = parsed;
    if (
      !steps ||
      !isStatus(status) ||
      (appId !== null && typeof appId !== "string") ||
      !areMarkets(selectedMarkets) ||
      !hasValidLifecycle(status, appId, selectedMarkets)
    ) {
      return NOT_STARTED_ONBOARDING;
    }
    return {
      version: ONBOARDING_VERSION,
      status,
      appId,
      selectedMarkets,
      ...steps,
    };
  } catch {
    return NOT_STARTED_ONBOARDING;
  }
}

export function readOnboardingState(
  account: string,
  storage?: OnboardingStorage,
): OnboardingState {
  try {
    const target = storage ?? window.localStorage;
    return parseOnboardingState(target.getItem(onboardingStorageKey(account)));
  } catch {
    return NOT_STARTED_ONBOARDING;
  }
}

export function writeOnboardingState(
  account: string,
  state: OnboardingState,
  storage?: OnboardingStorage,
): boolean {
  try {
    const target = storage ?? window.localStorage;
    target.setItem(onboardingStorageKey(account), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function claimBrowserOnboarding(
  account: string,
  storage?: OnboardingStorage,
): boolean {
  try {
    const target = storage ?? window.localStorage;
    const browserWide = target.getItem(ONBOARDING_STORAGE_KEY);
    if (browserWide === null) return false;
    const key = onboardingStorageKey(account);
    if (target.getItem(key) === null) target.setItem(key, browserWide);
    target.removeItem(ONBOARDING_STORAGE_KEY);
    notifyOnboardingChange();
    return true;
  } catch {
    return false;
  }
}

const unsavedSnapshots = new Map<string, string>();

export function getOnboardingSnapshot(
  account: string | undefined,
): string | null {
  if (!account) return null;
  const unsaved = unsavedSnapshots.get(account);
  if (unsaved !== undefined) return unsaved;
  try {
    return window.localStorage.getItem(onboardingStorageKey(account));
  } catch {
    return null;
  }
}

export const getServerOnboardingSnapshot = (): null => null;

export function subscribeOnboarding(onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(ACCOUNT_KEY_PREFIX)) {
      onChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(ONBOARDING_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ONBOARDING_CHANGE_EVENT, onChange);
  };
}

export function saveOnboardingState(
  account: string,
  state: OnboardingState,
): void {
  if (writeOnboardingState(account, state)) unsavedSnapshots.delete(account);
  else unsavedSnapshots.set(account, JSON.stringify(state));
  notifyOnboardingChange();
}

function notifyOnboardingChange(): void {
  try {
    window.dispatchEvent(new Event(ONBOARDING_CHANGE_EVENT));
  } catch {
    return;
  }
}

export function startOnboardingAfterImport(
  account: string,
  appId: string,
  homeMarket: string,
): boolean {
  claimBrowserOnboarding(account);
  const current = parseOnboardingState(getOnboardingSnapshot(account));
  const next = beginOnboarding(current, appId, homeMarket);
  if (next === current) return false;
  saveOnboardingState(account, next);
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
  return {
    ...state,
    selectedMarkets: [...markets].sort(),
    countriesReviewed: true,
  };
}

export function setStepSkipped(
  state: OnboardingState,
  step: SetupStep,
  skipped: boolean,
): OnboardingState {
  if (state.status !== "in_progress") return state;
  const steps = new Set(state.skipped);
  if (skipped) steps.add(step);
  else steps.delete(step);
  return { ...state, skipped: inStepOrder([...steps]) };
}

export const setCountriesReviewed = (
  state: OnboardingState,
): OnboardingState =>
  state.status === "in_progress"
    ? { ...state, countriesReviewed: true }
    : state;

export function stepState(
  state: OnboardingState,
  step: SetupStep,
  counts: SetupCounts,
): StepState {
  if (state.skipped.includes(step)) return "skipped";
  if (step === "countries") return state.countriesReviewed ? "done" : "open";
  const count = counts[step];
  if (count === null) return "loading";
  return count >= STEP_TARGETS[step] ? "done" : "open";
}

export function stepStates(
  state: OnboardingState,
  counts: SetupCounts,
): Record<SetupStep, StepState> {
  return {
    competitors: stepState(state, "competitors", counts),
    keywords: stepState(state, "keywords", counts),
    countries: stepState(state, "countries", counts),
  };
}

const isSettled = (step: StepState): boolean =>
  step === "done" || step === "skipped";

export function setupProgress(
  state: OnboardingState,
  counts: SetupCounts,
): StepProgress {
  const states = stepStates(state, counts);
  const next = SETUP_STEPS.find((step) => !isSettled(states[step]));
  return {
    done: SETUP_STEPS.filter((step) => isSettled(states[step])).length,
    total: SETUP_STEPS.length,
    next: next ?? null,
  };
}

export function canCompleteOnboarding(
  state: OnboardingState,
  counts: SetupCounts,
): boolean {
  return (
    state.status === "in_progress" &&
    state.selectedMarkets.length > 0 &&
    setupProgress(state, counts).next === null
  );
}

export function completeOnboarding(
  state: OnboardingState,
  counts: SetupCounts,
): OnboardingState {
  return canCompleteOnboarding(state, counts)
    ? { ...state, status: "completed" }
    : state;
}

export const dismissOnboarding = (state: OnboardingState): OnboardingState =>
  state.status === "in_progress" ? { ...state, status: "dismissed" } : state;
