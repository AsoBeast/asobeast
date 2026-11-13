import type {
  ActionEvidence,
  ActionRule,
  ActionSerpEntrant,
  MetadataField,
} from "@asobeast/shared";
import {
  formatDate,
  formatList,
  formatMeasure,
  formatNumber,
  pluralize,
} from "@/lib/format";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { ACTION_RULE_LABEL, percent } from "./action-copy";
import { changedFields } from "./action-headline";

export type BriefSegment = string | { strong: string };
export type BriefPart = BriefSegment[];

const NAMED_ENTRANTS = 2;
const NAMED_KEYWORDS = 2;

const strong = (value: string): BriefSegment => ({ strong: value });
const rank = (position: number): string => `#${formatNumber(position)}`;
const fieldWords = (fields: readonly MetadataField[]): string =>
  formatList(fields.map((field) => METADATA_FIELD_LABELS[field].toLowerCase()));

function present(parts: Array<BriefPart | null>): BriefPart[] {
  return parts.filter((part): part is BriefPart => part !== null);
}

function entrantsPart(entrants: readonly ActionSerpEntrant[]): BriefPart {
  if (entrants.length === 0) return ["no new app at or above you"];
  const named = entrants
    .slice(0, NAMED_ENTRANTS)
    .map((entrant) => `${entrant.title} entered at ${rank(entrant.position)}`);
  const more = entrants.length - named.length;
  return [more > 0 ? `${named.join(", ")} and ${more} more` : named.join(", ")];
}

function movedPart(
  previous: number | null,
  current: number | null,
): BriefPart | null {
  if (current === null) return null;
  if (previous === null) return ["You are ", strong(rank(current))];
  return [
    "You moved from ",
    strong(rank(previous)),
    " to ",
    strong(rank(current)),
  ];
}

function fellPart(
  before: number | null,
  after: number | null,
): BriefPart | null {
  if (before === null || after === null) return null;
  return [
    "Visibility fell from ",
    strong(formatMeasure(before)),
    " to ",
    strong(formatMeasure(after)),
  ];
}

type EvidenceOf<R extends ActionRule> = Extract<ActionEvidence, { rule: R }>;

const BRIEFS: {
  [R in ActionRule]: (evidence: EvidenceOf<R>) => BriefPart[];
} = {
  "keyword.add_uncovered": (evidence) =>
    present([
      ["Opportunity ", strong(formatMeasure(evidence.opportunity))],
      evidence.volume === null
        ? null
        : ["volume ", strong(formatMeasure(evidence.volume))],
      evidence.latestPosition === null
        ? null
        : ["ranks ", strong(rank(evidence.latestPosition))],
      evidence.uncoveredFields.length === 0
        ? null
        : [
            evidence.uncoveredFields.length === evidence.indexedFields.length
              ? "in no indexed field"
              : `missing from the ${fieldWords(evidence.uncoveredFields)}`,
          ],
      evidence.keywordFieldCharsFree
        ? [
            strong(formatNumber(evidence.keywordFieldCharsFree)),
            " characters free in the keyword field",
          ]
        : null,
    ]),
  "keyword.defend": (evidence) =>
    present([
      movedPart(evidence.previousPosition, evidence.yourPosition),
      entrantsPart(evidence.entrants),
    ]),
  "keyword.prune": (evidence) =>
    present([
      evidence.rankedDays === 0
        ? [
            "Never ranked in ",
            strong(formatNumber(evidence.checkedDays)),
            " checks",
          ]
        : [
            "Ranked on ",
            strong(
              `${formatNumber(evidence.rankedDays)} of ${formatNumber(evidence.checkedDays)}`,
            ),
            " checks",
          ],
      evidence.volume === null
        ? null
        : [`volume ${formatMeasure(evidence.volume)}`],
      [`saves ${pluralize(evidence.dailyRequestsSaved, "request")} a day`],
    ]),
  "rank.investigate_drop": (evidence) =>
    present([
      fellPart(evidence.visibilityBefore, evidence.visibilityAfter),
      [
        `your ${changedFields(evidence.fields)} changed on ${formatDate(evidence.changedAt)}`,
      ],
      [`${pluralize(evidence.droppedKeywords.length, "keyword")} fell`],
    ]),
  "serp.hold_volatile": (evidence) =>
    present([
      [
        "Volatility ",
        strong(`${formatMeasure(evidence.volatility)} of 100`),
        ` over ${evidence.windowDays} days`,
      ],
      evidence.yourPosition === null
        ? null
        : [`you are ${rank(evidence.yourPosition)}`],
      evidence.dampenedRules.length === 0
        ? null
        : [
            `holding back ${formatList(evidence.dampenedRules.map((rule) => ACTION_RULE_LABEL[rule]))}`,
          ],
    ]),
  "audit.fix_factor": (evidence) =>
    present([
      [
        "Worth ",
        strong(
          `${formatMeasure(evidence.weight)} of ${formatMeasure(evidence.totalWeight)}`,
        ),
        " in the audit",
      ],
      evidence.failingChecks.length === 0
        ? null
        : [
            `failing: ${formatList(evidence.failingChecks.map((check) => check.label))}`,
          ],
    ]),
  "reviews.investigate_theme": (evidence) => [
    [
      strong(formatNumber(evidence.mentions)),
      ` mentions in ${evidence.version ?? "the latest version"}, up from ${formatNumber(evidence.previousMentions)}`,
    ],
    [
      `${formatNumber(evidence.negativeReviews)} of ${formatNumber(evidence.totalReviews)} reviews are negative`,
    ],
  ],
  "market.improve_country": (evidence) => [
    [
      "Visibility ",
      strong(formatMeasure(evidence.marketVisibility)),
      ` against ${formatMeasure(evidence.homeVisibility)} at home`,
    ],
    [
      `${formatNumber(evidence.rankedKeywords)} of ${pluralize(evidence.trackedKeywords, "keyword")} rank`,
    ],
  ],
  "keyword.push_to_top10": (evidence) =>
    present([
      [
        "At ",
        strong(rank(evidence.latestPosition)),
        `, best ${rank(evidence.bestPosition)}`,
      ],
      [
        `${evidence.daysInBand} of ${evidence.windowDays} days between 11 and 20`,
      ],
      evidence.coveredFields.length === 0
        ? null
        : [`only in the ${fieldWords(evidence.coveredFields)}`],
    ]),
  "metadata.fix_lint": (evidence) => [
    [
      `${METADATA_FIELD_LABELS[evidence.field]} is `,
      strong(
        `${formatNumber(evidence.chars)} of ${formatNumber(evidence.limit)}`,
      ),
      " characters",
    ],
  ],
  "rank.investigate_unexplained_drop": (evidence) =>
    present([
      fellPart(evidence.visibilityBefore, evidence.visibilityAfter),
      [`${evidence.windowDays} days with no change of yours`],
      [`${pluralize(evidence.droppedKeywords.length, "keyword")} fell`],
    ]),
  "competitor.investigate_overtake": (evidence) => {
    const text = evidence.newTitle ?? evidence.newSubtitle;
    const named = evidence.keywords
      .slice(0, NAMED_KEYWORDS)
      .map((keyword) => keyword.text);
    const more = evidence.keywords.length - named.length;
    const ahead = more > 0 ? [...named, `${more} more`] : named;
    return present([
      text === null
        ? null
        : [
            `New ${evidence.newTitle === null ? "subtitle" : "title"} `,
            strong(`"${text}"`),
          ],
      ahead.length === 0 ? null : [`ahead of you on ${formatList(ahead)}`],
    ]);
  },
  "reviews.investigate_rating_decline": (evidence) =>
    present([
      [
        strong(formatNumber(evidence.recentReviews)),
        ` reviews in ${evidence.recentDays} days`,
      ],
      evidence.latestVersion === null
        ? null
        : [`latest version ${evidence.latestVersion}`],
      ["no single theme behind it"],
    ]),
  "reviews.reply_negative": (evidence) =>
    present([
      [
        strong(
          `${formatNumber(evidence.unanswered)} of ${formatNumber(evidence.checked)}`,
        ),
        " low reviews unanswered",
      ],
      evidence.replyRate === null
        ? null
        : [`reply rate ${percent(evidence.replyRate)}`],
      evidence.oldestUnansweredAt === null
        ? null
        : [`oldest from ${formatDate(evidence.oldestUnansweredAt)}`],
    ]),
  "listing.ship_update": (evidence) =>
    present([
      ["Last update ", strong(formatDate(evidence.storeUpdatedAt))],
      evidence.competitorMedianDays === null
        ? null
        : [
            `competitors update every ${formatMeasure(evidence.competitorMedianDays)} days (median of ${evidence.competitorsCompared})`,
          ],
    ]),
  "conversion.investigate_drop": (evidence) =>
    present([
      [
        "Get taps fell from ",
        strong(formatMeasure(evidence.getsBefore)),
        " to ",
        strong(formatMeasure(evidence.getsAfter)),
        " a day",
      ],
      [
        `page views ${formatMeasure(evidence.pageViewsBefore)} to ${formatMeasure(evidence.pageViewsAfter)}`,
      ],
      evidence.conversionBefore === null || evidence.conversionAfter === null
        ? null
        : [
            `conversion ${percent(evidence.conversionBefore)} to ${percent(evidence.conversionAfter)}`,
          ],
    ]),
  "listing.cpp_underperforms": (evidence) => [
    [
      strong(percent(evidence.pageConversion)),
      ` of page views become Get taps against ${percent(evidence.defaultConversion)} on the default`,
    ],
    [`${evidence.windowDays} days`],
  ],
};

export function actionBrief(evidence: ActionEvidence): BriefPart[] {
  switch (evidence.rule) {
    case "keyword.add_uncovered":
      return BRIEFS[evidence.rule](evidence);
    case "keyword.defend":
      return BRIEFS[evidence.rule](evidence);
    case "keyword.prune":
      return BRIEFS[evidence.rule](evidence);
    case "rank.investigate_drop":
      return BRIEFS[evidence.rule](evidence);
    case "serp.hold_volatile":
      return BRIEFS[evidence.rule](evidence);
    case "audit.fix_factor":
      return BRIEFS[evidence.rule](evidence);
    case "reviews.investigate_theme":
      return BRIEFS[evidence.rule](evidence);
    case "market.improve_country":
      return BRIEFS[evidence.rule](evidence);
    case "keyword.push_to_top10":
      return BRIEFS[evidence.rule](evidence);
    case "metadata.fix_lint":
      return BRIEFS[evidence.rule](evidence);
    case "rank.investigate_unexplained_drop":
      return BRIEFS[evidence.rule](evidence);
    case "competitor.investigate_overtake":
      return BRIEFS[evidence.rule](evidence);
    case "reviews.investigate_rating_decline":
      return BRIEFS[evidence.rule](evidence);
    case "reviews.reply_negative":
      return BRIEFS[evidence.rule](evidence);
    case "listing.ship_update":
      return BRIEFS[evidence.rule](evidence);
    case "conversion.investigate_drop":
      return BRIEFS[evidence.rule](evidence);
    case "listing.cpp_underperforms":
      return BRIEFS[evidence.rule](evidence);
    default: {
      const never: never = evidence;
      return never;
    }
  }
}

export function briefText(parts: readonly BriefPart[]): string {
  return parts
    .map((part) =>
      part
        .map((segment) =>
          typeof segment === "string" ? segment : segment.strong,
        )
        .join(""),
    )
    .join(" · ");
}
