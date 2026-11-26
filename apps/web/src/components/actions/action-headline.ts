import { ACTION_RULE_TITLES } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import type {
  ActionItem,
  ActionRule,
  ChangeField,
  MetadataField,
  RankInvestigateDropEvidence,
  RankInvestigateUnexplainedDropEvidence,
} from "@asobeast/shared";
import {
  formatCountryInLocale,
  formatListInLocale,
  formatMeasure,
  formatMeasureFixed,
} from "@/lib/format";
import { actionRuleLabel } from "./action-copy";

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
  inAppEvents: "in-app events",
  featuring: "featuring",
  editorsChoice: "editors' choice",
};

const FIELD_KEY = {
  title: "title",
  subtitle: "subtitle",
  summary: "summary",
  shortDescription: "summary",
  description: "description",
  version: "version",
  price: "price",
  screenshots: "screenshots",
  screenshotImages: "screenshotImages",
  screenshotCaptions: "screenshotCaptions",
  icon: "icon",
  whatsNew: "whatsNew",
  inAppEvents: "inAppEvents",
  featuring: "featuring",
  editorsChoice: "editorsChoice",
  keywordField: "keywordField",
  promotionalText: "promotionalText",
} as const satisfies Record<
  ChangeField | MetadataField,
  keyof typeof enActions.evidenceFields
>;

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

const quoted = (text: string): string => `"${text}"`;

const measure = (value: number): string =>
  formatMeasure(Math.round(value * 10) / 10);

export function changedFields(
  fields: readonly ChangeField[],
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  return formatListInLocale(
    fields.map((field) => {
      const label = t(`evidenceFields.${FIELD_KEY[field]}`);
      return locale === "en" ? label.toLowerCase() : label;
    }),
    locale,
  );
}

function degradedHeadline(
  item: ActionItem,
  t: MessageTranslator,
  locale: Locale,
): string {
  const title =
    locale === "en"
      ? ACTION_RULE_TITLES[item.rule]
      : actionRuleLabel(item.rule, t);
  const keyword = item.scope.keywordText;
  return keyword ? `${title}: ${quoted(keyword)}` : title;
}

function unexplainedHeadline(
  evidence: RankInvestigateUnexplainedDropEvidence,
  t: MessageTranslator,
  locale: Locale,
): string {
  const country = formatCountryInLocale(evidence.country, locale);
  return evidence.visibilityDelta < 1 && evidence.droppedKeywords.length > 0
    ? t("headline.unexplainedKeywords", {
        count: evidence.droppedKeywords.length,
        country,
      })
    : t("headline.unexplainedVisibility", {
        points: measure(evidence.visibilityDelta),
        country,
      });
}

function dropHeadline(
  evidence: RankInvestigateDropEvidence,
  t: MessageTranslator,
  locale: Locale,
): string {
  const fields = changedFields(evidence.fields, t, locale);
  return evidence.visibilityDelta
    ? t("headline.dropVisibility", {
        points: measure(Math.abs(evidence.visibilityDelta)),
        fields,
      })
    : t("headline.dropKeywords", {
        count: evidence.droppedKeywords.length,
        fields,
      });
}

const KEYWORD_RULES: readonly ActionRule[] = [
  "keyword.add_uncovered",
  "keyword.defend",
  "keyword.prune",
  "serp.hold_volatile",
  "keyword.push_to_top10",
];

export function actionHeadline(
  item: ActionItem,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const { evidence } = item;
  if (evidence === null) return degradedHeadline(item, t, locale);
  const keyword = item.scope.keywordText;
  if (keyword === null && KEYWORD_RULES.includes(evidence.rule)) {
    return locale === "en"
      ? ACTION_RULE_TITLES[evidence.rule]
      : actionRuleLabel(evidence.rule, t);
  }
  const subject = quoted(keyword ?? "");

  switch (evidence.rule) {
    case "keyword.add_uncovered":
      return t("headline.addKeyword", { keyword: subject });
    case "keyword.defend":
      return evidence.entrants.length > 0
        ? t("headline.defendEntrants", {
            keyword: subject,
            count: evidence.entrants.length,
          })
        : t("headline.defend", { keyword: subject });
    case "keyword.prune":
      return t("headline.prune", {
        keyword: subject,
        ranked: evidence.rankedDays,
        checked: evidence.checkedDays,
      });
    case "rank.investigate_drop":
      return dropHeadline(evidence, t, locale);
    case "serp.hold_volatile":
      return t("headline.hold", { keyword: subject });
    case "audit.fix_factor":
      return t("headline.raiseFactor", {
        factor: evidence.factorLabel,
        score: measure(evidence.score),
      });
    case "reviews.investigate_theme":
      return t("headline.reviewTheme", {
        theme: quoted(evidence.theme),
        version: evidence.version ?? t("headline.latestVersion"),
      });
    case "market.improve_country":
      return t("headline.marketGap", {
        points: measure(evidence.gap),
        country: formatCountryInLocale(evidence.country, locale),
      });
    case "keyword.push_to_top10":
      return t("headline.pushTop10", {
        keyword: subject,
        position: evidence.latestPosition,
      });
    case "rank.investigate_unexplained_drop":
      return unexplainedHeadline(evidence, t, locale);
    case "competitor.investigate_overtake":
      return t("headline.competitorOvertake", {
        competitor: evidence.competitorName ?? t("headline.aCompetitor"),
        fields: changedFields(evidence.fields, t, locale),
        count: evidence.keywords.length,
      });
    case "reviews.investigate_rating_decline":
      return t("headline.ratingDecline", {
        before: formatMeasureFixed(evidence.baselineAverage),
        after: formatMeasureFixed(evidence.recentAverage),
        days: evidence.recentDays,
      });
    case "reviews.reply_negative":
      return t("headline.replyNegative", { count: evidence.unanswered });
    case "listing.ship_update":
      return t("headline.shipUpdate", {
        days: formatMeasure(evidence.daysSinceUpdate),
      });
    case "conversion.investigate_drop":
      return t("headline.fewerGets", {
        country: evidence.country.toUpperCase(),
      });
    case "listing.cpp_underperforms":
      return t("headline.cppWeak", { page: evidence.pageTitle });
    case "metadata.fix_lint":
      return t("headline.lintProblems", {
        count: evidence.issues.length,
        field: t(`evidenceFields.${FIELD_KEY[evidence.field]}`).toLowerCase(),
      });
    default: {
      const never: never = evidence;
      return never;
    }
  }
}
