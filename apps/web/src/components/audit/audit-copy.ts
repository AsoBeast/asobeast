import type {
  AuditCheckSource,
  AuditCheckStatus,
  AuditEffort,
  AuditFactorAvailability,
  AuditGrade,
  AuditGroupId,
  AuditImpact,
  AuditRecommendations,
  AuditScreenshotMessage,
  AuditTarget,
  Store,
} from "@asobeast/shared";

export const PROVISIONAL_CONFIDENCE = 0.6;

export function provisional(
  confidence: number | undefined,
): confidence is number {
  return confidence !== undefined && confidence < PROVISIONAL_CONFIDENCE;
}

export const GRADE_LABEL: Record<AuditGrade, string> = {
  A: "Excellent",
  B: "Good",
  C: "Fair",
  D: "Weak",
  F: "Poor",
};

export const NO_GRADE_LABEL = "Not scored yet";

export const GROUP_LABEL: Record<AuditGroupId, string> = {
  discoverability: "Search visibility",
  conversion: "Conversion",
};

export const STATUS_LABEL: Record<AuditCheckStatus, string> = {
  pass: "Pass",
  warn: "Needs work",
  fail: "Fail",
  unanswered: "Not scored yet",
};

export const SOURCE_LABEL: Record<AuditCheckSource, string> = {
  store: "Store listing",
  keywords: "Your keywords",
  competitors: "Competitors",
  reviews: "Reviews",
  rankings: "Rankings",
  ai: "AI observation",
};

export const EFFORT_LABEL: Record<AuditEffort, string> = {
  minutes: "Minutes",
  hours: "Hours",
  weeks: "Weeks",
};

export const IMPACT_LABEL: Record<AuditImpact, string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};

export const BUCKET_LABEL: Record<keyof AuditRecommendations, string> = {
  quickWins: "Quick wins · Today",
  highImpact: "High impact · This week",
  strategic: "Strategic · This month",
};

export const BUCKET_TAB_LABEL: Record<keyof AuditRecommendations, string> = {
  quickWins: "Quick wins",
  highImpact: "High impact",
  strategic: "Strategic",
};

export const TARGET_LABEL: Record<AuditTarget, string> = {
  metadata: "Open the metadata workbench",
  keywords: "Open keywords",
  competitors: "Open competitors",
  reviews: "Open reviews",
  rankings: "Open rankings",
  "store-console": "Change it in your store console",
  "ai-analysis": "Analyze creative",
};

export const MESSAGE_LABEL: Record<AuditScreenshotMessage, string> = {
  benefit: "Benefit",
  feature: "Feature",
  "social-proof": "Social proof",
  "ui-only": "Interface only",
  onboarding: "Onboarding screen",
  other: "Other",
};

export const STORE_LABEL: Record<Store, string> = {
  APP_STORE: "App Store",
  GOOGLE_PLAY: "Google Play",
};

export const percent = (share: number): number => Math.round(share * 100);

export const gradeLabel = (grade: AuditGrade | null | undefined): string =>
  grade ? GRADE_LABEL[grade] : NO_GRADE_LABEL;

export const measuredLine = (confidence: number | undefined): string | null =>
  confidence === undefined
    ? null
    : `${percent(confidence)}% of the rubric measured`;

export const potentialLine = (potential: number): string =>
  `Reach ${Math.round(potential)} by finishing the plan`;

export const provisionalLine = (confidence: number): string =>
  `Provisional · ${percent(confidence)}% measured`;

export const availabilityLabel = (
  availability: AuditFactorAvailability | undefined,
  store: Store,
): string | null => {
  if (availability === "not-measurable") {
    return `Not measured on the ${STORE_LABEL[store]}`;
  }
  return availability === "awaiting-input" ? "Waiting for input" : null;
};

export const liftLabel = (lift: number | undefined): string =>
  `+${lift ?? 0} points`;

export const emptyBucketLine = (unanswered: number): string =>
  unanswered === 0
    ? "Nothing to change here."
    : `Nothing yet. ${unanswered} checks are not scored, so this list may grow.`;

export const scoreRingLabel = (
  overall: number | null,
  grade: AuditGrade | null | undefined,
  confidence: number | undefined,
): string =>
  overall === null
    ? "ASO score not available yet"
    : [
        `ASO score ${Math.round(overall)} out of 100`,
        `grade ${grade ?? "none"}`,
        gradeLabel(grade),
        ...(confidence === undefined
          ? []
          : [`${percent(confidence)}% measured`]),
      ].join(", ");
