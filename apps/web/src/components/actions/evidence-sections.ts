import type {
  ActionDroppedKeyword,
  ActionEvidence,
  ActionSerpEntrant,
  AuditFixFactorEvidence,
  KeywordAddUncoveredEvidence,
  KeywordDefendEvidence,
  KeywordPruneEvidence,
  KeywordPushToTop10Evidence,
  MarketImproveCountryEvidence,
  RankInvestigateDropEvidence,
  ReviewsInvestigateThemeEvidence,
  SerpHoldVolatileEvidence,
} from "@asobeast/shared";
import { formatRankPosition } from "@asobeast/shared";
import { formatDate, formatMeasure, formatNumber } from "@/lib/format";
import type { GradeMetric } from "@/lib/grade";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { ACTION_RULE_LABEL, summarizeEvidence } from "./action-copy";
import { CHANGE_FIELD_WORD } from "./action-headline";

export interface EvidenceFact {
  label: string;
  value: string;
  grade?: { metric: GradeMetric; value: number };
}

export interface EvidenceListItem {
  text: string;
  detail?: string;
  tone?: "up" | "down" | "neutral";
}

export interface EvidenceList {
  label: string;
  items: EvidenceListItem[];
}

export interface EvidenceSections {
  facts: EvidenceFact[];
  lists: EvidenceList[];
  summary: string;
}

const optional = (value: number | null): string =>
  value === null ? "—" : formatMeasure(value);

const days = (observed: number, window: number): string =>
  `${observed} of ${window}`;

const graded = (
  label: string,
  value: number | null,
  metric: GradeMetric,
  format: (value: number | null) => string = optional,
): EvidenceFact =>
  value === null
    ? { label, value: format(value) }
    : { label, value: format(value), grade: { metric, value } };

const fact = (label: string, value: string): EvidenceFact => ({ label, value });

const capitalized = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

const entrantItem = (entrant: ActionSerpEntrant): EvidenceListItem => ({
  text: entrant.title,
  detail: `#${entrant.position}${entrant.isCompetitor ? " · competitor" : ""}`,
  tone: "neutral",
});

const droppedItem = (keyword: ActionDroppedKeyword): EvidenceListItem => ({
  text: keyword.text,
  detail: `${formatRankPosition(keyword.from)} → ${formatRankPosition(keyword.to)}`,
  tone: "down",
});

type Sections = Pick<EvidenceSections, "facts" | "lists">;

function uncoveredSections(evidence: KeywordAddUncoveredEvidence): Sections {
  return {
    facts: [
      graded("Opportunity", evidence.opportunity, "opportunity"),
      graded("Volume", evidence.volume, "popularity"),
      fact("Difficulty", optional(evidence.difficulty)),
      fact("Relevance", optional(evidence.relevance)),
      graded(
        "Latest position",
        evidence.latestPosition,
        "position",
        formatRankPosition,
      ),
      fact("Keyword field free", optional(evidence.keywordFieldCharsFree)),
      fact(
        "Score confidence",
        evidence.scoreProvenance?.confidence ?? "unscored",
      ),
    ],
    lists: [
      {
        label: "Indexed fields",
        items: evidence.indexedFields.map((field) => ({
          text: METADATA_FIELD_LABELS[field],
        })),
      },
      {
        label: "Uncovered in",
        items: evidence.uncoveredFields.map((field) => ({
          text: METADATA_FIELD_LABELS[field],
        })),
      },
    ],
  };
}

function defendSections(evidence: KeywordDefendEvidence): Sections {
  return {
    facts: [
      graded(
        "Your position",
        evidence.yourPosition,
        "position",
        formatRankPosition,
      ),
      fact("Earlier position", formatRankPosition(evidence.previousPosition)),
      fact("New entrants", formatNumber(evidence.entrants.length)),
      fact("At or above you", formatNumber(evidence.entrantsAtOrAbove)),
      fact("Observed days", days(evidence.observedDays, evidence.windowDays)),
      fact("SERP volatility", optional(evidence.volatility)),
      graded("Volume", evidence.volume, "popularity"),
    ],
    lists: [
      {
        label: "New in the top 10",
        items: evidence.entrants.map(entrantItem),
      },
    ],
  };
}

function pruneSections(evidence: KeywordPruneEvidence): Sections {
  return {
    facts: [
      fact("Checked days", formatNumber(evidence.checkedDays)),
      fact("Ranked days", formatNumber(evidence.rankedDays)),
      graded(
        "Best position",
        evidence.bestPosition,
        "position",
        formatRankPosition,
      ),
      graded("Volume", evidence.volume, "popularity"),
      fact("Relevance", optional(evidence.relevance)),
      fact("Requests saved per day", formatNumber(evidence.dailyRequestsSaved)),
      fact(
        "Budget utilization",
        `${Math.round(evidence.budgetUtilization * 100)}%`,
      ),
    ],
    lists: [],
  };
}

function dropSections(evidence: RankInvestigateDropEvidence): Sections {
  return {
    facts: [
      fact("Changed on", formatDate(evidence.changedAt)),
      fact("Visibility before", optional(evidence.visibilityBefore)),
      fact("Visibility after", optional(evidence.visibilityAfter)),
      fact("Visibility delta", optional(evidence.visibilityDelta)),
      fact("Tracked keywords", formatNumber(evidence.trackedKeywords)),
      fact("Mean volatility", optional(evidence.meanVolatility)),
    ],
    lists: [
      {
        label: "Changed fields",
        items: evidence.fields.map((field) => ({
          text: capitalized(CHANGE_FIELD_WORD[field]),
        })),
      },
      {
        label: "Keywords that fell",
        items: evidence.droppedKeywords.map(droppedItem),
      },
    ],
  };
}

function volatileSections(evidence: SerpHoldVolatileEvidence): Sections {
  return {
    facts: [
      fact("Volatility", formatMeasure(evidence.volatility)),
      fact("Observed days", days(evidence.observedDays, evidence.windowDays)),
      graded(
        "Your position",
        evidence.yourPosition,
        "position",
        formatRankPosition,
      ),
    ],
    lists: [
      {
        label: "Rules held back",
        items: evidence.dampenedRules.map((rule) => ({
          text: ACTION_RULE_LABEL[rule],
        })),
      },
    ],
  };
}

function auditSections(evidence: AuditFixFactorEvidence): Sections {
  return {
    facts: [
      fact("Factor", evidence.factorLabel),
      fact("Score", `${formatMeasure(evidence.score)} of 10`),
      fact("Weight", formatMeasure(evidence.weight)),
      graded("Overall audit", evidence.overall, "audit"),
      fact(
        "Rubric covered",
        `${evidence.coveredWeight} of ${evidence.totalWeight}`,
      ),
      fact("Audit date", formatDate(evidence.auditDate)),
    ],
    lists: [
      {
        label: "Checks to fix",
        items: evidence.failingChecks.map((check) => ({
          text: check.label,
          detail: check.status,
          tone: "down",
        })),
      },
    ],
  };
}

function themeSections(evidence: ReviewsInvestigateThemeEvidence): Sections {
  return {
    facts: [
      fact("Theme", evidence.theme),
      fact("Version", evidence.version ?? "—"),
      fact("Previous version", evidence.previousVersion ?? "—"),
      fact("Mentions", formatNumber(evidence.mentions)),
      fact("Previously", formatNumber(evidence.previousMentions)),
      fact("Negative reviews", formatNumber(evidence.negativeReviews)),
      fact("Reviews for this version", formatNumber(evidence.totalReviews)),
      fact("Rating change", optional(evidence.ratingAvgDelta)),
      fact("Sample reviews", formatNumber(evidence.sampleReviewIds.length)),
    ],
    lists: [],
  };
}

function marketSections(evidence: MarketImproveCountryEvidence): Sections {
  return {
    facts: [
      fact("Market", evidence.country.toUpperCase()),
      fact("Home market", evidence.homeCountry.toUpperCase()),
      fact("Market visibility", formatMeasure(evidence.marketVisibility)),
      fact("Home visibility", formatMeasure(evidence.homeVisibility)),
      fact("Gap", formatMeasure(evidence.gap)),
      fact("Tracked keywords", formatNumber(evidence.trackedKeywords)),
      fact("Ranked keywords", formatNumber(evidence.rankedKeywords)),
      fact("Observed days", days(evidence.observedDays, evidence.windowDays)),
    ],
    lists: [],
  };
}

function pushSections(evidence: KeywordPushToTop10Evidence): Sections {
  return {
    facts: [
      graded(
        "Latest position",
        evidence.latestPosition,
        "position",
        formatRankPosition,
      ),
      fact("Best position", formatRankPosition(evidence.bestPosition)),
      fact("Days in band", days(evidence.daysInBand, evidence.windowDays)),
      graded("Volume", evidence.volume, "popularity"),
      fact("Relevance", optional(evidence.relevance)),
      graded("Opportunity", evidence.opportunity, "opportunity"),
    ],
    lists: [
      {
        label: "Covered only by",
        items: evidence.coveredFields.map((field) => ({
          text: METADATA_FIELD_LABELS[field],
        })),
      },
      {
        label: "Strong fields",
        items: evidence.strongFields.map((field) => ({
          text: METADATA_FIELD_LABELS[field],
        })),
      },
    ],
  };
}

function sections(evidence: ActionEvidence): Sections {
  switch (evidence.rule) {
    case "keyword.add_uncovered":
      return uncoveredSections(evidence);
    case "keyword.defend":
      return defendSections(evidence);
    case "keyword.prune":
      return pruneSections(evidence);
    case "rank.investigate_drop":
      return dropSections(evidence);
    case "serp.hold_volatile":
      return volatileSections(evidence);
    case "audit.fix_factor":
      return auditSections(evidence);
    case "reviews.investigate_theme":
      return themeSections(evidence);
    case "market.improve_country":
      return marketSections(evidence);
    case "keyword.push_to_top10":
      return pushSections(evidence);
    default: {
      const never: never = evidence;
      return never;
    }
  }
}

export function evidenceSections(evidence: ActionEvidence): EvidenceSections {
  const { facts, lists } = sections(evidence);
  return {
    facts,
    lists: lists.filter((list) => list.items.length > 0),
    summary: summarizeEvidence(evidence),
  };
}
