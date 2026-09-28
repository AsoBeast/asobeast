import type { ActionEvidence, ActionItem, Store } from "@asobeast/shared";
import { formatCountry, formatDate } from "@/lib/format";
import { ACTION_RULE_TITLE } from "./action-copy";

export const CONFIRMATION_STEP =
  "asobeast confirms the fix when this recommendation stops firing";

const STORE_CONSOLE: Record<Store, string> = {
  APP_STORE: "App Store Connect",
  GOOGLE_PLAY: "Play Console",
};

const STRONG_FIELDS: Record<Store, string> = {
  APP_STORE: "title and subtitle",
  GOOGLE_PLAY: "title and short description",
};

function addKeywordSteps(
  keyword: string,
  store: Store,
  charsFree: number | null,
): string[] {
  if (store === "GOOGLE_PLAY") {
    return [
      "Open the metadata workbench",
      `Add ${keyword} to the title or the short description`,
      "Use it naturally in the full description",
      "Publish the listing change in Play Console",
    ];
  }
  const room =
    charsFree !== null && charsFree > 0
      ? ` (${charsFree} characters free)`
      : "";
  return [
    "Open the metadata workbench",
    `Put ${keyword} in the subtitle, or in the keyword field${room}`,
    "Ship the change with your next release",
  ];
}

function ruleSteps(
  evidence: ActionEvidence,
  item: ActionItem,
  keyword: string,
): string[] {
  const { store, country } = item.scope;
  switch (evidence.rule) {
    case "keyword.add_uncovered":
      return addKeywordSteps(keyword, store, evidence.keywordFieldCharsFree);
    case "keyword.defend":
      return [
        `See who entered the top 10 for ${keyword}`,
        `Compare their ${STRONG_FIELDS[store]} with yours`,
        `Strengthen ${keyword} in your strongest field if the position matters`,
      ];
    case "keyword.prune":
      return [
        `Check ${keyword} on the keyword monitor`,
        "Pause it to save a request a day, or keep it if it matters to you",
      ];
    case "rank.investigate_drop":
      return [
        `Open your listing changes around ${formatDate(evidence.changedAt)}`,
        "Compare the keywords that fell with the text you changed",
        "Revert or adjust the change if the drop persists",
      ];
    case "serp.hold_volatile":
      return [
        `Wait before changing metadata for ${keyword}`,
        "Recheck when the results settle",
      ];
    case "audit.fix_factor":
      return [
        `Open the audit for ${evidence.factorLabel}`,
        ...(evidence.failingChecks.length > 0
          ? evidence.failingChecks.map((check) => `Fix: ${check.label}`)
          : [`Work through the audit advice for ${evidence.factorLabel}`]),
      ];
    case "reviews.investigate_theme":
      return [
        `Read the low reviews that mention "${evidence.theme}"`,
        `Check what changed in version ${evidence.version ?? "the latest version"}`,
        `Reply in ${STORE_CONSOLE[store]} where a fix is coming`,
      ];
    case "market.improve_country":
      return [
        `Open the keyword monitor for ${formatCountry(country)}`,
        "Find keywords that rank at home but not here",
        "Consider localizing the listing for this storefront",
      ];
    default: {
      const never: never = evidence;
      return never;
    }
  }
}

export function actionSteps(item: ActionItem): string[] {
  if (item.evidence === null) {
    return [ACTION_RULE_TITLE[item.rule], CONFIRMATION_STEP];
  }
  const keyword = item.scope.keywordText
    ? `"${item.scope.keywordText}"`
    : "the keyword";
  return [...ruleSteps(item.evidence, item, keyword), CONFIRMATION_STEP];
}
