import type {
  ActionItem,
  ActionRule,
  ChangeField,
  RankInvestigateDropEvidence,
  RankInvestigateUnexplainedDropEvidence,
} from "@asobeast/shared";
import {
  formatCountry,
  formatList,
  formatMeasure,
  pluralize,
} from "@/lib/format";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { ACTION_RULE_TITLE } from "./action-copy";

export const CHANGE_FIELD_WORD: Record<ChangeField, string> = {
  title: "title",
  subtitle: "subtitle",
  summary: "short description",
  description: "description",
  version: "version",
  price: "price",
  screenshots: "screenshots",
  screenshotImages: "screenshot images",
  screenshotCaptions: "screenshot captions",
  icon: "icon",
  whatsNew: "what's new",
};

const quoted = (text: string): string => `"${text}"`;

const measure = (value: number): string =>
  formatMeasure(Math.round(value * 10) / 10);

export function changedFields(fields: readonly ChangeField[]): string {
  return formatList(fields.map((field) => CHANGE_FIELD_WORD[field]));
}

function degradedHeadline(item: ActionItem): string {
  const title = ACTION_RULE_TITLE[item.rule];
  const keyword = item.scope.keywordText;
  return keyword ? `${title}: ${quoted(keyword)}` : title;
}

function unexplainedHeadline(
  evidence: RankInvestigateUnexplainedDropEvidence,
): string {
  const country = formatCountry(evidence.country);
  return evidence.visibilityDelta < 1 && evidence.droppedKeywords.length > 0
    ? `Find out why ${pluralize(evidence.droppedKeywords.length, "keyword")} fell in ${country}`
    : `Find out why visibility fell ${measure(evidence.visibilityDelta)} points in ${country}`;
}

function dropHeadline(evidence: RankInvestigateDropEvidence): string {
  const fields = changedFields(evidence.fields);
  return evidence.visibilityDelta
    ? `Investigate the ${measure(Math.abs(evidence.visibilityDelta))} point drop after your ${fields} change`
    : `Investigate ${pluralize(evidence.droppedKeywords.length, "keyword drop")} after your ${fields} change`;
}

const KEYWORD_RULES: readonly ActionRule[] = [
  "keyword.add_uncovered",
  "keyword.defend",
  "keyword.prune",
  "serp.hold_volatile",
  "keyword.push_to_top10",
];

export function actionHeadline(item: ActionItem): string {
  const { evidence } = item;
  if (evidence === null) return degradedHeadline(item);
  const keyword = item.scope.keywordText;
  if (keyword === null && KEYWORD_RULES.includes(evidence.rule)) {
    return ACTION_RULE_TITLE[evidence.rule];
  }
  const subject = quoted(keyword ?? "");

  switch (evidence.rule) {
    case "keyword.add_uncovered":
      return `Add ${subject} to your metadata`;
    case "keyword.defend":
      return evidence.entrants.length > 0
        ? `Defend ${subject}: ${pluralize(evidence.entrants.length, "new app")} in the top 10`
        : `Defend ${subject} in the top 10`;
    case "keyword.prune":
      return `Retire ${subject}: ranked on ${evidence.rankedDays} of ${evidence.checkedDays} days`;
    case "rank.investigate_drop":
      return dropHeadline(evidence);
    case "serp.hold_volatile":
      return `Hold changes on ${subject} while its results are volatile`;
    case "audit.fix_factor":
      return `Raise ${evidence.factorLabel} from ${measure(evidence.score)} of 10`;
    case "reviews.investigate_theme":
      return `Look into ${quoted(evidence.theme)} in reviews of ${evidence.version ?? "the latest version"}`;
    case "market.improve_country":
      return `Close the ${measure(evidence.gap)} point visibility gap in ${formatCountry(evidence.country)}`;
    case "keyword.push_to_top10":
      return `Push ${subject} from #${evidence.latestPosition} into the top 10`;
    case "rank.investigate_unexplained_drop":
      return unexplainedHeadline(evidence);
    case "competitor.investigate_overtake":
      return `${evidence.competitorName ?? "A competitor"} changed its ${changedFields(evidence.fields)} and passed you on ${pluralize(evidence.keywords.length, "keyword")}`;
    case "reviews.investigate_rating_decline":
      return `Review scores fell from ${measure(evidence.baselineAverage)} to ${measure(evidence.recentAverage)} in the last ${evidence.recentDays} days`;
    case "reviews.reply_negative":
      return `Reply to ${pluralize(evidence.unanswered, "unanswered low review")}`;
    case "listing.ship_update":
      return `Ship an update: your listing is ${formatMeasure(evidence.daysSinceUpdate)} days old`;
    case "metadata.fix_lint":
      return `Fix ${pluralize(evidence.issues.length, "store rule problem")} in your ${METADATA_FIELD_LABELS[evidence.field].toLowerCase()}`;
    default: {
      const never: never = evidence;
      return never;
    }
  }
}
