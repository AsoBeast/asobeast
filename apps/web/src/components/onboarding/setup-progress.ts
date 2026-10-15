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

export const progressPercent = ({ done, total }: SetupStepProgress): number =>
  total === 0 ? 0 : (done / total) * 100;

export const progressValueLabel = ({ done, total }: SetupStepProgress) =>
  `${done} of ${total} steps`;

export function stepLabel(step: SetupStep): string {
  return `Step ${SETUP_STEPS.indexOf(step) + 1} of ${SETUP_STEPS.length}`;
}

export const activeKeywordCount = (
  keywords: readonly { active: boolean }[],
): number => keywords.filter((keyword) => keyword.active).length;

export type AppInSetup = PortfolioApp & { setup: AppSetupSummary };

const isInSetup = (app: PortfolioApp): app is AppInSetup =>
  app.setup?.status === "in_progress";

const touchedAt = (app: AppInSetup): number => {
  const time = Date.parse(app.setup.updatedAt ?? "");
  return Number.isNaN(time) ? 0 : time;
};

const byLastTouched = (left: AppInSetup, right: AppInSetup): number => {
  const [first, second] = [touchedAt(left), touchedAt(right)];
  if (first === second) return 0;
  return first > second ? -1 : 1;
};

export function bannerApps(
  apps: readonly PortfolioApp[],
): { app: AppInSetup; more: number } | null {
  const [app, ...rest] = apps.filter(isInSetup).sort(byLastTouched);
  return app ? { app, more: rest.length } : null;
}
