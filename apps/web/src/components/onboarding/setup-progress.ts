import {
  SETUP_STEPS,
  type AppSetupSummary,
  type PortfolioApp,
  type SetupStep,
  type SetupStepProgress,
} from "@asobeast/shared";

export const STEP_TITLES: Record<SetupStep, string> = {
  competitors: "Pick competitors",
  keywords: "Track keywords",
  countries: "Add countries",
};

export const nextLabel = (step: SetupStep): string =>
  STEP_TITLES[step].toLowerCase();

export function progressSentence(
  name: string | null,
  progress: SetupStepProgress,
): string {
  const next =
    progress.next === null
      ? "ready to complete"
      : `next: ${nextLabel(progress.next)}`;
  return `Set up ${name ?? "this app"} · ${progress.done} of ${progress.total} · ${next}`;
}

export const setupSentence = (name: string | null): string =>
  `Set up ${name ?? "this app"}`;

export const loadingSentence = (name: string | null): string =>
  `${setupSentence(name)} · loading progress`;

export const progressPercent = ({ done, total }: SetupStepProgress): number =>
  total === 0 ? 0 : (done / total) * 100;

export function stepLabel(step: SetupStep): string {
  return `Step ${SETUP_STEPS.indexOf(step) + 1} of ${SETUP_STEPS.length}`;
}

export const activeKeywordCount = (
  keywords: readonly { active: boolean }[],
): number => keywords.filter((keyword) => keyword.active).length;

export type AppInSetup = PortfolioApp & { setup: AppSetupSummary };

const isInSetup = (app: PortfolioApp): app is AppInSetup =>
  app.setup?.status === "in_progress";

const touchedAt = (app: AppInSetup): number =>
  app.setup.updatedAt === null ? -Infinity : Date.parse(app.setup.updatedAt);

export function bannerApps(
  apps: readonly PortfolioApp[],
): { app: AppInSetup; more: number } | null {
  const [app, ...rest] = apps
    .filter(isInSetup)
    .sort((left, right) => touchedAt(right) - touchedAt(left));
  return app ? { app, more: rest.length } : null;
}
