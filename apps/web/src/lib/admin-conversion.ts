import type {
  AdminConversion,
  AdminConversionWindow,
  AdminFunnelStepKey,
  AdminMedianDays,
  AdminTrialRate,
} from "@asobeast/shared";
import { formatDayMonth, formatNumber, pluralize } from "./format";

export const CONVERSION_TAB_WINDOW: AdminConversionWindow = 90;

export const FUNNEL_STEP_LABELS: Record<AdminFunnelStepKey, string> = {
  "signed-up": "Signed up",
  "confirmed-email": "Confirmed email",
  "first-app": "Imported a first app",
  "ranked-within-a-day": "Ranked within a day",
  "trial-started": "Started a trial",
  paid: "Paid",
};

export interface FunnelRow {
  key: AdminFunnelStepKey;
  label: string;
  count: number;
  ofPrevious: number | null;
  ofFirst: number;
}

const shareOf = (part: number, whole: number) =>
  whole === 0 ? 0 : part / whole;

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

export function funnelRows(funnel: AdminConversion["funnel"]): FunnelRow[] {
  const steps = inEntryOrder(funnel);
  const first = steps[0]?.count ?? 0;
  return steps.map((step, index) => ({
    key: step.key,
    label: FUNNEL_STEP_LABELS[step.key],
    count: step.count,
    ofPrevious:
      index === 0 ? null : shareOf(step.count, steps[index - 1].count),
    ofFirst: shareOf(step.count, first),
  }));
}

export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
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

const days = (value: number) =>
  `${formatNumber(value)} ${value === 1 ? "day" : "days"}`;

export function medianLine(medians: AdminMedianDays): string | null {
  const parts = [
    medians.signupToFirstApp != null
      ? `${days(medians.signupToFirstApp)} to a first app`
      : null,
    medians.signupToTrial != null
      ? `${days(medians.signupToTrial)} to a trial`
      : null,
    medians.trialToPaid != null
      ? `${days(medians.trialToPaid)} from trial to paid`
      : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : `Median ${parts.join(" · ")}`;
}

export function unrecordedNote(
  recordedSince: string | null,
  windowDays: number,
  generatedAt: string,
): string | null {
  if (recordedSince === null) return null;
  const windowStart =
    new Date(generatedAt).getTime() - windowDays * 24 * 60 * 60_000;
  if (new Date(recordedSince).getTime() <= windowStart) return null;
  return `Workspaces erased before ${formatDayMonth(recordedSince)} are not counted.`;
}

export function departuresTitle(windowDays: number): string {
  return `Left in the last ${pluralize(windowDays, "day")}`;
}
