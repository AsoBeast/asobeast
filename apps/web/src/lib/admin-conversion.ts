import type {
  AdminConversion,
  AdminConversionWindow,
  AdminFunnelStepKey,
  AdminMedianDays,
  AdminTrialRate,
} from "@asobeast/shared";
import type { MessageTranslator, TranslationContext } from "@/i18n/translator";
import type { Locale } from "./locale";
import { formatDayMonthInLocale } from "./format";

export const CONVERSION_TAB_WINDOW: AdminConversionWindow = 90;

const FUNNEL_STEP_KEYS: Record<AdminFunnelStepKey, string> = {
  "signed-up": "conversion.funnelSteps.signedUp",
  "confirmed-email": "conversion.funnelSteps.confirmedEmail",
  "first-app": "conversion.funnelSteps.firstApp",
  "ranked-within-a-day": "conversion.funnelSteps.rankedWithinADay",
  "trial-started": "conversion.funnelSteps.trialStarted",
  paid: "conversion.funnelSteps.paid",
};

export interface FunnelRow {
  key: AdminFunnelStepKey;
  label: string;
  count: number;
  ofPrevious: number | null;
  ofFirst: number | null;
}

const shareOf = (part: number, whole: number) =>
  whole === 0 ? null : part / whole;

const ENTRY_ORDER: readonly AdminFunnelStepKey[] = [
  "signed-up",
  "confirmed-email",
  "trial-started",
  "first-app",
  "ranked-within-a-day",
  "paid",
];

const inEntryOrder = (funnel: AdminConversion["funnel"]) =>
  [...funnel].sort(
    (a, b) => ENTRY_ORDER.indexOf(a.key) - ENTRY_ORDER.indexOf(b.key),
  );

export function funnelRows(
  funnel: AdminConversion["funnel"],
  translator: MessageTranslator,
): FunnelRow[] {
  const steps = inEntryOrder(funnel);
  const first = steps[0]?.count ?? 0;
  return steps.map((step, index) => ({
    key: step.key,
    label: translator(FUNNEL_STEP_KEYS[step.key]),
    count: step.count,
    ofPrevious:
      index === 0 ? null : shareOf(step.count, steps[index - 1].count),
    ofFirst: shareOf(step.count, first),
  }));
}

export function formatShare(share: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(share);
}

export function trialRate(rate: AdminTrialRate): number | null {
  return rate.ended === 0 ? null : rate.paid / rate.ended;
}

export function rateChange(
  current: AdminTrialRate,
  previous: AdminTrialRate,
): number | null {
  const now = trialRate(current);
  const before = trialRate(previous);
  return now === null || before === null
    ? null
    : Math.round((now - before) * 100);
}

export function medianLine(
  medians: AdminMedianDays,
  translator: MessageTranslator,
): string | null {
  const days = (value: number) =>
    translator("common.dayCount", { count: value });
  const parts = [
    medians.signupToFirstApp != null
      ? translator("conversion.medianToFirstApp", {
          days: days(medians.signupToFirstApp),
        })
      : null,
    medians.signupToTrial != null
      ? translator("conversion.medianToTrial", {
          days: days(medians.signupToTrial),
        })
      : null,
    medians.trialToPaid != null
      ? translator("conversion.medianTrialToPaid", {
          days: days(medians.trialToPaid),
        })
      : null,
  ].filter((part) => part !== null);
  return parts.length === 0
    ? null
    : translator("conversion.median", { parts: parts.join(" · ") });
}

export function unrecordedNote(
  recordedSince: string | null,
  windowDays: number,
  generatedAt: string,
  context: TranslationContext,
): string | null {
  if (recordedSince === null) return null;
  const windowStart =
    new Date(generatedAt).getTime() - windowDays * 24 * 60 * 60_000;
  if (new Date(recordedSince).getTime() <= windowStart) return null;
  return context.translator("conversion.unrecorded", {
    date: formatDayMonthInLocale(recordedSince, context.locale),
  });
}

export function departuresTitle(
  windowDays: number,
  translator: MessageTranslator,
): string {
  return translator("conversion.departuresTitle", { days: windowDays });
}
