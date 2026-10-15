export const SETUP_STEPS = ['competitors', 'keywords', 'countries'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export const SETUP_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
  'dismissed',
] as const;
export type SetupStatus = (typeof SETUP_STATUSES)[number];

export const SETUP_COMPETITOR_TARGET = 1;
export const SETUP_KEYWORD_TARGET = 10;
export const SETUP_MARKETS_MAX = 50;

export interface AppSetupState {
  appId: string;
  status: SetupStatus;
  skipped: SetupStep[];
  countriesReviewed: boolean;
  selectedMarkets: string[];
  completedAt: string | null;
  updatedAt: string | null;
}

export interface AppSetupUpdateRequest {
  status?: SetupStatus;
  skipped?: SetupStep[];
  countriesReviewed?: boolean;
  selectedMarkets?: string[];
}

type CountedStep = Exclude<SetupStep, 'countries'>;

export type SetupCounts = Record<CountedStep, number | null>;

export type SetupStepState = 'done' | 'skipped' | 'open' | 'loading';

export interface SetupStepProgress {
  done: number;
  total: number;
  next: SetupStep | null;
}

export interface AppSetupSummary extends SetupStepProgress {
  status: SetupStatus;
  updatedAt: string | null;
}

type SetupSteps = Pick<AppSetupState, 'skipped' | 'countriesReviewed'>;

const STEP_TARGETS: Record<CountedStep, number> = {
  competitors: SETUP_COMPETITOR_TARGET,
  keywords: SETUP_KEYWORD_TARGET,
};

export function stepState(
  setup: SetupSteps,
  step: SetupStep,
  counts: SetupCounts,
): SetupStepState {
  const reached =
    step === 'countries'
      ? setup.countriesReviewed
      : (counts[step] ?? 0) >= STEP_TARGETS[step];
  if (reached) return 'done';
  if (setup.skipped.includes(step)) return 'skipped';
  return step !== 'countries' && counts[step] === null ? 'loading' : 'open';
}

export function stepStates(
  setup: SetupSteps,
  counts: SetupCounts,
): Record<SetupStep, SetupStepState> {
  return {
    competitors: stepState(setup, 'competitors', counts),
    keywords: stepState(setup, 'keywords', counts),
    countries: stepState(setup, 'countries', counts),
  };
}

const isSettled = (step: SetupStepState): boolean =>
  step === 'done' || step === 'skipped';

export function setupProgress(
  setup: SetupSteps,
  counts: SetupCounts,
): SetupStepProgress {
  const states = stepStates(setup, counts);
  const next = SETUP_STEPS.find((step) => !isSettled(states[step]));
  return {
    done: SETUP_STEPS.filter((step) => isSettled(states[step])).length,
    total: SETUP_STEPS.length,
    next: next ?? null,
  };
}

export function canCompleteSetup(
  setup: Pick<
    AppSetupState,
    'status' | 'selectedMarkets' | 'skipped' | 'countriesReviewed'
  >,
  counts: SetupCounts,
): boolean {
  return (
    setup.status === 'in_progress' &&
    setup.selectedMarkets.length > 0 &&
    setupProgress(setup, counts).next === null
  );
}

export function setupSummary(
  setup: AppSetupState,
  counts: SetupCounts,
): AppSetupSummary {
  return {
    status: setup.status,
    updatedAt: setup.updatedAt,
    ...setupProgress(setup, counts),
  };
}
