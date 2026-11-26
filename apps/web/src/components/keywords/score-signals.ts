import { createTranslator } from "next-intl";
import { formatUtcDate, isFloorAnswer, SERP_FLAGS } from "@asobeast/shared";
import type { ScoreSignals, ScoringSource, SerpFlag } from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

const FLAG_KEYS: Record<SerpFlag, string> = {
  brand: "brand",
  weak_leader: "weakLeader",
  small_serp: "smallSerp",
  padded: "padded",
};

function flagLine(flag: SerpFlag, t: MessageTranslator): string {
  return t(`scores.signals.${FLAG_KEYS[flag]}`);
}

function reachLine(signals: ScoreSignals, t: MessageTranslator): string {
  switch (signals.suggestReach) {
    case "hit": {
      const typed = signals.suggestPrefixLength;
      const position = signals.suggestPosition;
      if (typed === null || position === null) {
        return t("scores.signals.reachWhileTyping");
      }
      return t("scores.signals.reachAfter", {
        count: typed,
        position,
      });
    }
    case "listed":
      return t("scores.signals.reachListed");
    case "absent":
      return t("scores.signals.reachAbsent");
    case "unavailable":
      return t("scores.signals.reachUnavailable");
  }
}

function searchModelLines(
  signals: ScoreSignals,
  shown: number | null,
  t: MessageTranslator,
): string[] {
  const estimate =
    signals.estimatedTraffic === null ? null : signals.estimatedTraffic * 10;
  const capped = shown !== null && estimate !== null && shown < estimate - 0.5;
  return capped
    ? [t("scores.signals.searchModel"), t("scores.signals.unlistedCap")]
    : [t("scores.signals.searchModel")];
}

function lastAboveFloorLines(
  signals: ScoreSignals,
  t: MessageTranslator,
): string[] {
  const last = signals.officialPopularityLastAboveFloor;
  return last
    ? [
        t("scores.signals.lastAboveFloor", {
          value: last.value,
          week: formatUtcDate(last.week),
        }),
      ]
    : [];
}

function floorAnswerLines(
  signals: ScoreSignals,
  t: MessageTranslator,
): string[] | null {
  const state = signals.officialPopularityState;
  if (!isFloorAnswer(state)) {
    return null;
  }
  const floor =
    typeof signals.officialPopularityFloor === "number"
      ? signals.officialPopularityFloor
      : "none";
  const week = signals.officialPopularityWeek
    ? formatUtcDate(signals.officialPopularityWeek)
    : "none";
  if (state === "floor") {
    return [
      t("scores.signals.floorAnswerLine", { floor, week }),
      ...lastAboveFloorLines(signals, t),
    ];
  }
  return [
    t("scores.signals.searchModel"),
    t("scores.signals.leftOutLine", { floor, week }),
    ...lastAboveFloorLines(signals, t),
  ];
}

export function popularitySignalLines(
  signals: ScoreSignals | null,
  source?: ScoringSource,
  shown: number | null = null,
  t: MessageTranslator = english,
): string[] {
  if (!signals) {
    return [];
  }
  const floorLines = floorAnswerLines(signals, t);
  if (floorLines) {
    return floorLines;
  }
  if (signals.officialPopularity !== null) {
    return [
      t("scores.signals.officialPopularity", {
        value: signals.officialPopularity,
      }),
    ];
  }
  return source === "APPLE_SEARCH_SIGNALS"
    ? searchModelLines(signals, shown, t)
    : [reachLine(signals, t)];
}

const LOWER_CONFIDENCE_KEYS = {
  difficulty: "difficulty",
  opportunity: "opportunity",
} as const;

export function lowerConfidenceLines(
  score: keyof typeof LOWER_CONFIDENCE_KEYS,
  signals: ScoreSignals | null,
  t: MessageTranslator = english,
): string[] {
  return isFloorAnswer(signals?.officialPopularityState)
    ? [t(`scores.signals.lowerConfidence.${LOWER_CONFIDENCE_KEYS[score]}`)]
    : [];
}

function serpLines(signals: ScoreSignals, t: MessageTranslator): string[] {
  if (signals.flags.length > 0) {
    return SERP_FLAGS.filter((flag) => signals.flags.includes(flag)).map(
      (flag) => flagLine(flag, t),
    );
  }
  return signals.medianRatingCount === null
    ? []
    : [
        t("scores.signals.typicalTopTen", {
          count: Math.round(signals.medianRatingCount),
        }),
      ];
}

export function difficultySignalLines(
  signals: ScoreSignals | null,
  t: MessageTranslator = english,
): string[] {
  if (!signals) {
    return [];
  }
  return [
    ...serpLines(signals, t),
    ...lowerConfidenceLines("difficulty", signals, t),
  ];
}

export const REVEAL_WORDS = {
  suggested: enKeywords.scores.reveal.suggested,
  full: enKeywords.scores.reveal.full,
  absent: enKeywords.scores.reveal.absent,
  dash: enKeywords.scores.reveal.dash,
} as const;

export function revealWords(t: MessageTranslator = english) {
  return {
    suggested: t("scores.reveal.suggested"),
    full: t("scores.reveal.full"),
    absent: t("scores.reveal.absent"),
    dash: t("scores.reveal.dash"),
  };
}

export function revealLabel(
  signals: ScoreSignals | null,
  t: MessageTranslator = english,
): string | null {
  const words = revealWords(t);
  switch (signals?.suggestReach) {
    case "hit": {
      const typed = signals.suggestPrefixLength;
      const position = signals.suggestPosition;
      if (typed === null || position === null) {
        return words.suggested;
      }
      return t("scores.reveal.letters", {
        count: typed,
        position,
      });
    }
    case "listed":
      return words.full;
    case "absent":
      return words.absent;
    default:
      return null;
  }
}

const REVEAL_LISTED_RANK = 1_000_000_000;
const REVEAL_ABSENT_RANK = 2_000_000_000;
const REVEAL_POSITION_SPAN = 1_000_000;
const REVEAL_UNKNOWN_PREFIX = 100;
const REVEAL_UNKNOWN_POSITION = REVEAL_POSITION_SPAN - 1;

export function revealRank(signals: ScoreSignals | null): number | null {
  switch (signals?.suggestReach) {
    case "hit":
      return (
        (signals.suggestPrefixLength ?? REVEAL_UNKNOWN_PREFIX) *
          REVEAL_POSITION_SPAN +
        (signals.suggestPosition ?? REVEAL_UNKNOWN_POSITION)
      );
    case "listed":
      return REVEAL_LISTED_RANK;
    case "absent":
      return REVEAL_ABSENT_RANK;
    default:
      return null;
  }
}
