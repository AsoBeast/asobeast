import type {
  ActionCategory,
  ActionEvidence,
  ActionPriority,
  ActionRule,
  ActionStatus,
} from "@asobeast/shared";
import { formatMeasure } from "@/lib/format";

const measure = (value: number | null): string =>
  value === null ? "—" : formatMeasure(value);

export const ACTION_RULE_TITLE: Record<ActionRule, string> = {
  "keyword.add_uncovered": "Add a high-opportunity keyword to your metadata",
  "keyword.defend": "Defend a keyword competitors just entered",
  "keyword.prune": "Retire a keyword that never ranks",
  "rank.investigate_drop": "Investigate a drop after your metadata change",
  "serp.hold_volatile": "Hold — these results are unusually volatile",
  "audit.fix_factor": "Fix a weak audit factor",
  "reviews.investigate_theme": "Investigate a new negative review theme",
  "market.improve_country": "Investigate an underperforming market",
};

export const ACTION_RULE_LABEL: Record<ActionRule, string> = {
  "keyword.add_uncovered": "Uncovered keywords",
  "keyword.defend": "Keywords to defend",
  "keyword.prune": "Keywords to prune",
  "rank.investigate_drop": "Rank drops",
  "serp.hold_volatile": "Volatile results",
  "audit.fix_factor": "Weak audit factors",
  "reviews.investigate_theme": "Review themes",
  "market.improve_country": "Underperforming markets",
};

export const ACTION_PRIORITY_LABEL: Record<ActionPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const ACTION_CATEGORY_LABEL: Record<ActionCategory, string> = {
  metadata: "Metadata",
  competition: "Competition",
  regression: "Regression",
  conversion: "Conversion",
  reputation: "Reputation",
  markets: "Markets",
  hygiene: "Hygiene",
};

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  OPEN: "Open",
  SNOOZED: "Snoozed",
  DONE: "Done",
  DISMISSED: "Dismissed",
  RESOLVED: "Resolved",
};

export function summarizeEvidence(evidence: ActionEvidence): string {
  switch (evidence.rule) {
    case "keyword.add_uncovered":
      return `Opportunity ${measure(evidence.opportunity)} with volume ${measure(evidence.volume)}, and no indexed field contains it.`;
    case "keyword.defend":
      return `${measure(evidence.entrants.length)} new apps entered the top 10, ${measure(evidence.entrantsAtOrAbove)} of them at or above you.`;
    case "keyword.prune":
      return `Ranked on ${measure(evidence.rankedDays)} of ${measure(evidence.checkedDays)} checks and costs ${measure(evidence.dailyRequestsSaved)} request per day.`;
    case "rank.investigate_drop":
      return `You changed ${evidence.fields.join(", ")} on ${evidence.changedAt} and ${measure(evidence.droppedKeywords.length)} tracked keywords fell.`;
    case "serp.hold_volatile":
      return `These results churn at ${measure(evidence.volatility)}/100, so today's movement is not a reliable signal.`;
    case "audit.fix_factor":
      return `${evidence.factorLabel} scored ${measure(evidence.score)}/10 at weight ${measure(evidence.weight)} in the audit of ${evidence.auditDate}.`;
    case "reviews.investigate_theme":
      return `"${evidence.theme}" appears in ${measure(evidence.mentions)} negative reviews of ${evidence.version ?? "the latest version"}, up from ${measure(evidence.previousMentions)}.`;
    case "market.improve_country":
      return `${evidence.country.toUpperCase()} sits ${measure(evidence.gap)} visibility points behind ${evidence.homeCountry.toUpperCase()}. Investigate this market.`;
    default: {
      const never: never = evidence;
      return never;
    }
  }
}

export const ACTION_IMPACT_CAPTION =
  "Estimated impact, computed from the evidence below. It is not a prediction of downloads, revenue or rank.";

export const ACTION_AI_DISCLAIMER =
  "AI summary of the evidence above. The recommendation, priority and impact are computed deterministically.";
