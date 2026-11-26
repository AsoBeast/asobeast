import type {
  AuditCheckStatus,
  AuditFactorAvailability,
  AuditGrade,
  AuditGroupId,
  AuditRecommendations,
  Store,
} from "@asobeast/shared";
import { healthTone, type HealthTone } from "@/components/ui/meter";
import { createTranslator } from "next-intl";
import enAudit from "../../../messages/en/audit.json";
import type { MessageTranslator } from "@/i18n/translator";
import { storeLabel } from "@/lib/format";

const english = createTranslator({
  locale: "en",
  namespace: "audit",
  messages: { audit: enAudit },
});

export const PROVISIONAL_CONFIDENCE = 0.6;

export const BUCKETS = [
  "quickWins",
  "highImpact",
  "strategic",
] as const satisfies readonly (keyof AuditRecommendations)[];

const TONE_STATUS: Record<HealthTone, AuditCheckStatus> = {
  success: "pass",
  warning: "warn",
  destructive: "fail",
};

export const scoreStatus = (score: number | null): AuditCheckStatus =>
  score === null ? "unanswered" : TONE_STATUS[healthTone(score / 10)];

export function provisional(
  confidence: number | undefined,
): confidence is number {
  return confidence !== undefined && confidence < PROVISIONAL_CONFIDENCE;
}

export const percent = (share: number): number => Math.round(share * 100);

export const gradeLabel = (
  grade: AuditGrade | null | undefined,
  t: MessageTranslator = english,
): string => (grade ? t(`grades.${grade}`) : t("grades.none"));

export const groupLabel = (
  group: AuditGroupId,
  t: MessageTranslator = english,
): string => t(`groups.${group}`);

export const measuredLine = (
  confidence: number | undefined,
  t: MessageTranslator = english,
): string | null =>
  confidence === undefined
    ? null
    : t("measured", { percent: percent(confidence) });

export const potentialLine = (
  potential: number,
  t: MessageTranslator = english,
): string => t("potential", { score: Math.round(potential) });

export const availabilityLabel = (
  availability: AuditFactorAvailability | undefined,
  store: Store,
  t: MessageTranslator = english,
): string | null => {
  if (availability === "not-measurable") {
    return t("availability.notMeasurable", { store: storeLabel(store) });
  }
  return availability === "awaiting-input" ? t("availability.awaiting") : null;
};

export const liftLabel = (
  lift: number | undefined,
  t: MessageTranslator = english,
): string =>
  lift === undefined ? t("lift.unknown") : t("lift.points", { points: lift });

const LIFT_DIGITS = 1;

export const liftFigure = (lift: number | undefined): string =>
  lift === undefined ? "—" : `+${lift}`;

export function fixesWorth(
  fixes: readonly { lift?: number }[],
  t: MessageTranslator = english,
): string | null {
  const lifts = fixes.flatMap((fix) => fix.lift ?? []);
  if (lifts.length === 0) return null;
  const total = lifts.reduce((sum, lift) => sum + lift, 0);
  return t("fixesWorth", { points: total.toFixed(LIFT_DIGITS) });
}

export const scoredFactorsLine = (
  scored: number,
  total: number,
  t: MessageTranslator = english,
): string =>
  scored === total
    ? t("allFactorsScored", { total })
    : t("scoredFactors", { scored, total });

export const emptyBucketLine = (
  unanswered: number,
  t: MessageTranslator = english,
): string =>
  unanswered === 0
    ? t("emptyBucket")
    : t("emptyBucketPending", { count: unanswered });

export const scoreRingLabel = (
  overall: number | null,
  grade: AuditGrade | null | undefined,
  confidence: number | undefined,
  t: MessageTranslator = english,
): string =>
  overall === null
    ? t("scoreUnavailable")
    : t("scoreRing", {
        score: Math.round(overall),
        grade: grade ?? "none",
        label: gradeLabel(grade, t),
        measured:
          confidence === undefined
            ? ""
            : `, ${t("measuredShort", { percent: percent(confidence) })}`,
      });
