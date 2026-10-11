import type {
  KeywordBreakdownInsight,
  KeywordBreakdownStanding,
  KeywordPlacement,
} from "@asobeast/shared";
import { formatList, formatNumber, pluralize } from "@/lib/format";

const FIELD_NAMES: Partial<Record<KeywordPlacement, string>> = {
  title: "title",
  subtitle: "subtitle",
  shortDescription: "short description",
  keywordField: "keyword field",
};

function theirPlacement(placement: KeywordPlacement): string {
  const field = FIELD_NAMES[placement];
  if (field) return `Has the keyword in its ${field}`;
  return placement === "split"
    ? "Has every word, spread over its fields"
    : "Has some of the words";
}

function yourPlacement(placement: KeywordPlacement): string {
  const field = FIELD_NAMES[placement];
  if (field) return `yours is in the ${field}`;
  if (placement === "split") return "your words are spread over fields";
  return placement === "partial"
    ? "you have only some of the words"
    : "your listing does not have it";
}

export function insightText(insight: KeywordBreakdownInsight): string {
  switch (insight.rule) {
    case "placement":
      return `${theirPlacement(insight.theirs)}; ${yourPlacement(insight.yours)}.`;
    case "ratings":
      return `No stronger placement than yours, but ${formatNumber(insight.theirs)} ratings to your ${formatNumber(insight.yours)}.`;
    case "unchecked":
      return `No visible match, and ${insight.localizations} of its language versions could not be checked.`;
    case "hidden":
      return "No visible match in any listing this market reads, so it likely ranks through its keyword field.";
    case "similar":
      return "Placement and ratings are close to yours, so the gap likely comes from installs or its keyword field.";
  }
}

export function standingLines(standing: KeywordBreakdownStanding): string[] {
  const lines: string[] = [];
  if (standing.missingTerms.length > 0) {
    lines.push(
      `No single listing of yours has ${formatList(
        standing.missingTerms.map((term) => `“${term}”`),
      )}, so you are not fully eligible for this search.`,
    );
  }
  if (standing.above > 0) {
    const stronger = standing.aboveWithStrongerPlacement;
    lines.push(
      `${standing.above} of ${pluralize(standing.competitors, "competitor")} ${standing.above === 1 ? "ranks" : "rank"} above you${
        stronger > 0
          ? `, ${stronger} with the keyword in a stronger place than yours.`
          : ", none with a stronger placement than yours."
      }`,
    );
  } else if (standing.competitors > 0) {
    lines.push("You rank above every tracked competitor on this keyword.");
  }
  if (standing.changedDaysAgo !== null) {
    lines.push(
      `Your listing text changed ${pluralize(standing.changedDaysAgo, "day")} ago. Ranks usually settle two to four weeks after a change.`,
    );
  }
  return lines;
}
