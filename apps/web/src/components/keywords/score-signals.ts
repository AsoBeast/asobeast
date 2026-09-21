import { SERP_FLAGS } from "@asobeast/shared";
import type { ScoreSignals, SerpFlag } from "@asobeast/shared";
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
      const typed = signals.suggestPrefixLength ?? 0;
      const unit = typed === 1 ? "character" : "characters";
      return `The store suggests it after ${typed} typed ${unit}, in position ${signals.suggestPosition ?? 0}.`;
    }
    case "listed":
      return "The store suggests it only once the whole phrase is typed.";
    case "absent":
      return "The store never suggests this phrase, so volume is capped.";
    case "unavailable":
      return "Suggestions were unavailable, so volume comes from the ranking apps alone.";
  }
}

export function trafficSignalLines(signals: ScoreSignals | null): string[] {
  if (!signals) {
    return [];
  }
  const official =
    signals.officialPopularity === null
      ? []
      : [
          `Apple reports a search popularity of ${signals.officialPopularity} for this term.`,
        ];
  return [...official, reachLine(signals)];
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
