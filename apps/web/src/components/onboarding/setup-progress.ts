import {
  SETUP_KEYWORD_TARGET,
  SETUP_STEPS,
  type AppSetupSummary,
  type PortfolioApp,
  type SetupStep,
  type SetupStepProgress,
  type SetupStepState,
  type Store,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enSetup from "../../../messages/en/setup.json";
import type { MessageTranslator } from "@/i18n/translator";
import {
  formatCountryInLocale,
  formatDayMonthInLocale,
  formatListInLocale,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "setup",
  messages: { setup: enSetup },
});

export const stepTitle = (
  step: SetupStep,
  t: MessageTranslator = english,
): string => t(`steps.${step}.title`);

export const keywordsStepDescription = (
  store: Store,
  t: MessageTranslator = english,
): string =>
  t("steps.keywords.description", {
    target: SETUP_KEYWORD_TARGET,
    surface: t(
      store === "APP_STORE"
        ? "steps.keywords.surfaceAppStore"
        : "steps.keywords.surfaceGooglePlay",
    ),
  });

export const nextLabel = (
  step: SetupStep,
  t: MessageTranslator = english,
): string => t(`steps.${step}.next`);

export function progressSentence(
  name: string | null,
  progress: SetupStepProgress,
  t: MessageTranslator = english,
): string {
  const next =
    progress.next === null
      ? t("progress.ready")
      : t("progress.next", { step: nextLabel(progress.next, t) });
  return t("progress.sentence", {
    name: name ?? t("status.thisApp"),
    done: progress.done,
    total: progress.total,
    next,
  });
}

export const progressPercent = ({ done, total }: SetupStepProgress): number =>
  total === 0 ? 0 : (done / total) * 100;

export const progressValueLabel = (
  progress: SetupStepProgress,
  t: MessageTranslator = english,
) => t("progress.value", { done: progress.done, total: progress.total });

const isUnsettled = (state: SetupStepState): boolean =>
  state === "open" || state === "loading";

export function completionHint(
  states: Record<SetupStep, SetupStepState>,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string | null {
  const left = SETUP_STEPS.filter((step) => isUnsettled(states[step]));
  return left.length === 0
    ? null
    : t("progress.completionHint", {
        steps: formatListInLocale(
          left.map((step) => nextLabel(step, t)),
          locale,
        ),
      });
}

export function completedFacts(
  {
    competitors,
    keywords,
    home,
    markets,
    completedAt,
  }: {
    competitors: number | null;
    keywords: number | null;
    home: string;
    markets: number;
    completedAt: string | null;
  },
  t: MessageTranslator = english,
  locale: Locale = "en",
): string[] {
  return [
    competitors === null
      ? null
      : t("facts.competitors", { count: competitors }),
    keywords === null
      ? null
      : t("facts.keywordsInMarket", {
          count: keywords,
          country: formatCountryInLocale(home, locale),
        }),
    t("facts.countries", { count: markets }),
    completedAt === null
      ? null
      : t("facts.completedAt", {
          date: formatDayMonthInLocale(completedAt, locale),
        }),
  ].filter((fact) => fact !== null);
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
