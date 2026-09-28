import type { ActionItem, ChangeField } from "@asobeast/shared";
import {
  formatCountry,
  formatList,
  formatMeasure,
  pluralize,
} from "@/lib/format";
import { ACTION_RULE_TITLE } from "./action-copy";

const CHANGE_FIELD_WORD: Record<ChangeField, string> = {
  title: "title",
  subtitle: "subtitle",
  summary: "short description",
  description: "description",
  version: "version",
  price: "price",
  screenshots: "screenshots",
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

export function actionHeadline(item: ActionItem): string {
  const { evidence } = item;
  if (evidence === null) return degradedHeadline(item);
  const keyword = item.scope.keywordText;
  const subject = keyword ? quoted(keyword) : null;

  switch (evidence.rule) {
    case "keyword.add_uncovered":
      return subject
        ? `Add ${subject} to your metadata`
        : ACTION_RULE_TITLE[evidence.rule];
    case "keyword.defend":
      if (!subject) return ACTION_RULE_TITLE[evidence.rule];
      return evidence.entrants.length > 0
        ? `Defend ${subject}: ${pluralize(evidence.entrants.length, "new app")} in the top 10`
        : `Defend ${subject} in the top 10`;
    case "keyword.prune":
      return subject
        ? `Retire ${subject}: ranked on ${evidence.rankedDays} of ${evidence.checkedDays} days`
        : ACTION_RULE_TITLE[evidence.rule];
    case "rank.investigate_drop": {
      const fields = changedFields(evidence.fields);
      return evidence.visibilityDelta
        ? `Investigate the ${measure(Math.abs(evidence.visibilityDelta))} point drop after your ${fields} change`
        : `Investigate ${pluralize(evidence.droppedKeywords.length, "keyword drop")} after your ${fields} change`;
    }
    case "serp.hold_volatile":
      return subject
        ? `Hold changes on ${subject} while its results are volatile`
        : ACTION_RULE_TITLE[evidence.rule];
    case "audit.fix_factor":
      return `Raise ${evidence.factorLabel} from ${measure(evidence.score)} of 10`;
    case "reviews.investigate_theme":
      return `Look into ${quoted(evidence.theme)} in reviews of ${evidence.version ?? "the latest version"}`;
    case "market.improve_country":
      return `Close the ${measure(evidence.gap)} point visibility gap in ${formatCountry(evidence.country)}`;
    default: {
      const never: never = evidence;
      return never;
    }
  }
}
