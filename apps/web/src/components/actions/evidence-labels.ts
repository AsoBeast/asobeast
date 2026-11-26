import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { ActionEvidence } from "@asobeast/shared";
import { ACTION_RULE_LABEL, actionRuleLabel } from "./action-copy";

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

const LABEL_KEY = {
  Opportunity: "opportunity",
  Volume: "volume",
  Difficulty: "difficulty",
  Relevance: "relevance",
  "Latest position": "latestPosition",
  "Keyword field free": "keywordFieldFree",
  "Score confidence": "scoreConfidence",
  "Indexed fields": "indexedFields",
  "Uncovered in": "uncoveredIn",
  "Earlier position": "earlierPosition",
  "New entrants": "newEntrants",
  "At or above you": "atOrAboveYou",
  "Observed days": "observedDays",
  "SERP volatility": "serpVolatility",
  "New in the top 10": "newTop10",
  "Checked days": "checkedDays",
  "Ranked days": "rankedDays",
  "Requests saved per day": "requestsSaved",
  "Changed on": "changedOn",
  "Visibility before": "visibilityBefore",
  "Visibility after": "visibilityAfter",
  "Visibility delta": "visibilityDelta",
  "Tracked keywords": "trackedKeywords",
  "Ranked keywords": "rankedKeywords",
  "Mean volatility": "meanVolatility",
  "Changed fields": "changedFields",
  "Your last change": "yourLastChange",
  "Keywords that fell": "keywordsFell",
  Market: "market",
  Competitor: "competitor",
  "New title": "newTitle",
  "New subtitle": "newSubtitle",
  "Keywords passed": "keywordsPassed",
  "Keywords they passed you on": "keywordsPassedOn",
  Volatility: "volatility",
  "Rules held back": "rulesHeldBack",
  Factor: "factor",
  Score: "score",
  Weight: "weight",
  "Overall audit": "overallAudit",
  "Rubric covered": "rubricCovered",
  "Audit date": "auditDate",
  "Checks to fix": "checksToFix",
  Theme: "theme",
  Version: "version",
  "Previous version": "previousVersion",
  Mentions: "mentions",
  Previously: "previously",
  "Negative reviews": "negativeReviews",
  "Reviews for this version": "reviewsVersion",
  "Rating change": "ratingChange",
  "Sample reviews": "sampleReviews",
  "Recent average": "recentAverage",
  "Earlier average": "earlierAverage",
  Drop: "drop",
  "Negative share": "negativeShare",
  "Latest version": "latestVersion",
  Unanswered: "unanswered",
  "Checked for a reply": "checkedReply",
  "Low reviews": "lowReviews",
  Window: "window",
  "Last store update": "lastStoreUpdate",
  "Days since update": "daysSinceUpdate",
  "Competitor median": "competitorMedian",
  "Competitors compared": "competitorsCompared",
  "Complete through": "completeThrough",
  "Product page": "productPage",
  "Page conversion": "pageConversion",
  "Default page conversion": "defaultConversion",
  Ratio: "ratio",
  "Unique impressions": "uniqueImpressions",
  "Product page views": "productPageViews",
  "Home market": "homeMarket",
  "Market visibility": "marketVisibility",
  "Home visibility": "homeVisibility",
  Gap: "gap",
  "Best position": "bestPosition",
  "Days in band": "daysInBand",
  "Covered only by": "coveredOnlyBy",
  "Strong fields": "strongFields",
  Field: "field",
  Characters: "characters",
  Problems: "problems",
  "Problems to fix": "problemsToFix",
  "Your position": "yourPosition",
  "Get taps a day": "getTapsDay",
  "Page views a day": "pageViewsDay",
  Conversion: "conversion",
  Compared: "compared",
  "Recent reviews": "recentReviews",
  "Earlier reviews": "earlierReviews",
  "Reply rate": "replyRate",
  "Oldest unanswered": "oldestUnanswered",
} as const satisfies Record<string, keyof typeof enActions.evidenceLabels>;

const FIELD_KEY = {
  Title: "title",
  Subtitle: "subtitle",
  "Short description": "summary",
  Description: "description",
  Version: "version",
  Price: "price",
  Screenshots: "screenshots",
  "Screenshot images": "screenshotImages",
  "Screenshot captions": "screenshotCaptions",
  Icon: "icon",
  "What's new": "whatsNew",
  "In-app events": "inAppEvents",
  Featuring: "featuring",
  "Editors' choice": "editorsChoice",
  "Keyword field": "keywordField",
  "Promotional text": "promotionalText",
} as const satisfies Record<string, keyof typeof enActions.evidenceFields>;

export const localizedLabel = (label: string, t: MessageTranslator): string => {
  const key = LABEL_KEY[label as keyof typeof LABEL_KEY];
  return key ? t(`evidenceLabels.${key}`) : label;
};

export const localizedField = (text: string, t: MessageTranslator): string => {
  const key = FIELD_KEY[text as keyof typeof FIELD_KEY];
  return key ? t(`evidenceFields.${key}`) : text;
};

export const localizedItemText = (
  text: string,
  t: MessageTranslator,
): string => {
  const field = localizedField(text, t);
  if (field !== text) return field;
  const rule = (
    Object.entries(ACTION_RULE_LABEL) as Array<[ActionEvidence["rule"], string]>
  ).find(([, label]) => label === text)?.[0];
  return rule ? actionRuleLabel(rule, t) : text;
};

export const evidenceEnglish = english;
