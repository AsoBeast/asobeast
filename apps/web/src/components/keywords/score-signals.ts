import { SERP_FLAGS } from "@asobeast/shared";
import type { ScoreSignals, ScoringSource, SerpFlag } from "@asobeast/shared";
import { formatNumber } from "@/lib/format";

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
      return "Suggestions were unavailable, so volume comes from the ranking apps alone.";
  }
}

const SEARCH_MODEL_LINE =
  "Estimated from the first 25 App Store results, on Apple's search popularity scale.";
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

export function popularitySignalLines(
  signals: ScoreSignals | null,
  source?: ScoringSource,
  shown: number | null = null,
): string[] {
  if (!signals) {
    return [];
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

export function difficultySignalLines(signals: ScoreSignals | null): string[] {
  if (!signals) {
    return [];
  }
  if (signals.flags.length > 0) {
    return SERP_FLAGS.filter((flag) => signals.flags.includes(flag)).map(
      (flag) => FLAG_LINES[flag],
    );
  }
  return signals.medianRatingCount === null
    ? []
    : [
        `Typical top ten app: ${formatNumber(Math.round(signals.medianRatingCount))} ratings.`,
      ];
}
