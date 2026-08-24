import type { ActionEvidence } from "@asobeast/shared";
import { formatRankPosition } from "@asobeast/shared";
import { formatDate, formatMeasure, formatNumber } from "@/lib/format";

type Fact = [string, string];

const optional = (value: number | null): string =>
  value === null ? "—" : formatMeasure(value);

function factsFor(evidence: ActionEvidence): Fact[] {
  switch (evidence.rule) {
    case "keyword.add_uncovered":
      return [
        ["Opportunity", formatMeasure(evidence.opportunity)],
        ["Volume", optional(evidence.volume)],
        ["Difficulty", optional(evidence.difficulty)],
        ["Relevance", optional(evidence.relevance)],
        ["Latest position", formatRankPosition(evidence.latestPosition)],
        ["Indexed fields", evidence.indexedFields.join(", ") || "—"],
        ["Uncovered in", evidence.uncoveredFields.join(", ") || "—"],
        ["Keyword field free", optional(evidence.keywordFieldCharsFree)],
        [
          "Score confidence",
          evidence.scoreProvenance?.confidence ?? "unscored",
        ],
      ];
    case "keyword.defend":
      return [
        ["Your position", formatRankPosition(evidence.yourPosition)],
        ["Earlier position", formatRankPosition(evidence.previousPosition)],
        ["New entrants", formatNumber(evidence.entrants.length)],
        ["At or above you", formatNumber(evidence.entrantsAtOrAbove)],
        ["Observed days", `${evidence.observedDays} of ${evidence.windowDays}`],
        ["SERP volatility", optional(evidence.volatility)],
        ["Volume", optional(evidence.volume)],
        [
          "Entrants",
          evidence.entrants
            .map(
              (entrant) =>
                `#${entrant.position} ${entrant.title}${entrant.isCompetitor ? " (tracked competitor)" : ""}`,
            )
            .join(", ") || "—",
        ],
      ];
    case "keyword.prune":
      return [
        ["Checked days", formatNumber(evidence.checkedDays)],
        ["Ranked days", formatNumber(evidence.rankedDays)],
        ["Best position", formatRankPosition(evidence.bestPosition)],
        ["Volume", optional(evidence.volume)],
        ["Relevance", optional(evidence.relevance)],
        ["Requests saved per day", formatNumber(evidence.dailyRequestsSaved)],
        [
          "Budget utilization",
          `${Math.round(evidence.budgetUtilization * 100)}%`,
        ],
      ];
    case "rank.investigate_drop":
      return [
        ["Changed on", formatDate(evidence.changedAt)],
        ["Fields", evidence.fields.join(", ")],
        ["Visibility before", optional(evidence.visibilityBefore)],
        ["Visibility after", optional(evidence.visibilityAfter)],
        ["Visibility delta", optional(evidence.visibilityDelta)],
        ["Tracked keywords", formatNumber(evidence.trackedKeywords)],
        [
          "Dropped keywords",
          evidence.droppedKeywords
            .map(
              (keyword) =>
                `${keyword.text} ${formatRankPosition(keyword.from)} → ${formatRankPosition(keyword.to)}`,
            )
            .join(", ") || "—",
        ],
        ["Mean volatility", optional(evidence.meanVolatility)],
      ];
    case "serp.hold_volatile":
      return [
        ["Volatility", formatMeasure(evidence.volatility)],
        ["Observed days", `${evidence.observedDays} of ${evidence.windowDays}`],
        ["Your position", formatRankPosition(evidence.yourPosition)],
        ["Damped rules", evidence.dampenedRules.join(", ")],
      ];
    case "audit.fix_factor":
      return [
        ["Factor", evidence.factorLabel],
        ["Score", `${formatMeasure(evidence.score)} of 10`],
        ["Weight", formatMeasure(evidence.weight)],
        ["Overall audit", optional(evidence.overall)],
        [
          "Rubric covered",
          `${evidence.coveredWeight} of ${evidence.totalWeight}`,
        ],
        ["Audit date", formatDate(evidence.auditDate)],
        [
          "Failing checks",
          evidence.failingChecks
            .map((check) => `${check.label} (${check.status})`)
            .join(", ") || "—",
        ],
      ];
    case "reviews.investigate_theme":
      return [
        ["Theme", evidence.theme],
        ["Version", evidence.version ?? "—"],
        ["Previous version", evidence.previousVersion ?? "—"],
        ["Mentions", formatNumber(evidence.mentions)],
        ["Previously", formatNumber(evidence.previousMentions)],
        ["Negative reviews", formatNumber(evidence.negativeReviews)],
        ["Reviews for this version", formatNumber(evidence.totalReviews)],
        ["Rating change", optional(evidence.ratingAvgDelta)],
        ["Sample reviews", formatNumber(evidence.sampleReviewIds.length)],
      ];
    case "market.improve_country":
      return [
        ["Market", evidence.country.toUpperCase()],
        ["Home market", evidence.homeCountry.toUpperCase()],
        ["Market visibility", formatMeasure(evidence.marketVisibility)],
        ["Home visibility", formatMeasure(evidence.homeVisibility)],
        ["Gap", formatMeasure(evidence.gap)],
        ["Tracked keywords", formatNumber(evidence.trackedKeywords)],
        ["Ranked keywords", formatNumber(evidence.rankedKeywords)],
        ["Observed days", `${evidence.observedDays} of ${evidence.windowDays}`],
      ];
    default: {
      const never: never = evidence;
      return never;
    }
  }
}

export function ActionEvidencePanel({
  evidence,
  degraded,
  lastSeenAt,
}: {
  evidence: ActionEvidence | null;
  degraded: boolean;
  lastSeenAt: string;
}) {
  if (degraded || !evidence) {
    return (
      <p className="text-sm text-muted-foreground">
        Evidence unavailable for this stored action — it will be rebuilt on the
        next run.
      </p>
    );
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Why this
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-body sm:grid-cols-2">
        {factsFor(evidence).map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 border-b border-dashed border-border/60 pb-1"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="numeric font-mono text-right font-medium">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-caption text-muted-foreground">
        Last confirmed {formatDate(lastSeenAt)}
      </p>
    </details>
  );
}
