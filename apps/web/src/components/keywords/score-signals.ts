import { formatUtcDate, isFloorAnswer, SERP_FLAGS } from "@asobeast/shared";
import type { ScoreSignals, ScoringSource, SerpFlag } from "@asobeast/shared";
import { pluralize } from "@/lib/format";

const FLAG_LINES: Record<SerpFlag, string> = {
  brand: "A brand search: one app dominates this page.",
  weak_leader: "The top result has fewer than 100 ratings.",
  small_serp: "The store returns three results or fewer.",
  padded: "Few results target this phrase; the page is padded with other apps.",
};

function reachLine(signals: ScoreSignals): string {
  switch (signals.suggestReach) {
    case "hit": {
      const typed = signals.suggestPrefixLength;
      const position = signals.suggestPosition;
      if (typed === null || position === null) {
        return "The store suggests it while it is being typed.";
      }
      const unit = typed === 1 ? "character" : "characters";
      return `The store suggests it after ${typed} typed ${unit}, in position ${position}.`;
    }
    case "listed":
      return "The store suggests it only once the whole phrase is typed.";
    case "absent":
      return "The store never suggests this phrase, so volume is capped.";
    case "unavailable":
      return "Suggestions were unavailable, so volume assumes a typical reach.";
  }
}

const SEARCH_MODEL_LINE =
  "Estimated from the first 25 App Store results and search suggestions, on Apple's search popularity scale.";
const UNLISTED_CAP_LINE =
  "Apple does not list this term among its most searched, so it is held below the lowest popularity Apple published for its genre.";

function searchModelLines(
  signals: ScoreSignals,
  shown: number | null,
): string[] {
  const estimate =
    signals.estimatedTraffic === null ? null : signals.estimatedTraffic * 10;
  const capped = shown !== null && estimate !== null && shown < estimate - 0.5;
  return capped ? [SEARCH_MODEL_LINE, UNLISTED_CAP_LINE] : [SEARCH_MODEL_LINE];
}

function weekPhrase(signals: ScoreSignals): string {
  const week = signals.officialPopularityWeek;
  return week ? ` for the week of ${formatUtcDate(week)}` : "";
}

function floorValue(signals: ScoreSignals): number | null {
  const floor = signals.officialPopularityFloor;
  return typeof floor === "number" ? floor : null;
}

function lastAboveFloorLines(signals: ScoreSignals): string[] {
  const last = signals.officialPopularityLastAboveFloor;
  return last
    ? [
        `The last value above the floor was ${last.value} in the week of ${formatUtcDate(last.week)}.`,
      ]
    : [];
}

function floorAnswerLines(signals: ScoreSignals): string[] | null {
  const state = signals.officialPopularityState;
  if (!isFloorAnswer(state)) {
    return null;
  }
  const week = weekPhrase(signals);
  const floor = floorValue(signals);
  return state === "floor"
    ? [
        `Apple answered its floor value${floor === null ? "" : ` (${floor})`}${week}.`,
        ...lastAboveFloorLines(signals),
      ]
    : [
        SEARCH_MODEL_LINE,
        `Apple left this term out of its list${week}, so its popularity is below the floor${floor === null ? "" : ` of ${floor}`} and the number shown is held under it.`,
        ...lastAboveFloorLines(signals),
      ];
}

export function popularitySignalLines(
  signals: ScoreSignals | null,
  source?: ScoringSource,
  shown: number | null = null,
): string[] {
  if (!signals) {
    return [];
  }
  const floorLines = floorAnswerLines(signals);
  if (floorLines) {
    return floorLines;
  }
  if (signals.officialPopularity !== null) {
    return [
      `Apple reports a search popularity of ${signals.officialPopularity} for this term.`,
    ];
  }
  return source === "APPLE_SEARCH_SIGNALS"
    ? searchModelLines(signals, shown)
    : [reachLine(signals)];
}

const LOWER_CONFIDENCE_LINES = {
  difficulty:
    "Popularity for this term is an Apple floor answer, so the confidence of this row is capped at Medium. Difficulty itself is read from the search results.",
  opportunity:
    "Opportunity is built from popularity, and popularity for this term is an Apple floor answer, so read it with lower confidence.",
} as const;

export function lowerConfidenceLines(
  score: keyof typeof LOWER_CONFIDENCE_LINES,
  signals: ScoreSignals | null,
): string[] {
  return isFloorAnswer(signals?.officialPopularityState)
    ? [LOWER_CONFIDENCE_LINES[score]]
    : [];
}

function serpLines(signals: ScoreSignals): string[] {
  if (signals.flags.length > 0) {
    return SERP_FLAGS.filter((flag) => signals.flags.includes(flag)).map(
      (flag) => FLAG_LINES[flag],
    );
  }
  return signals.medianRatingCount === null
    ? []
    : [
        `Typical top ten app: ${pluralize(Math.round(signals.medianRatingCount), "rating")}.`,
      ];
}

export function difficultySignalLines(signals: ScoreSignals | null): string[] {
  if (!signals) {
    return [];
  }
  return [
    ...serpLines(signals),
    ...lowerConfidenceLines("difficulty", signals),
  ];
}
