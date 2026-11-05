import type {
  CompetitorGaps,
  KeywordComparisonCompetitor,
} from "@asobeast/shared";
import { pluralize } from "./format";
import { gapEmpty, gapRows, type GapEmpty } from "./gap-lists";

export type GapHeadline =
  | { kind: Exclude<GapEmpty, "none"> }
  | { kind: "quiet" }
  | {
      kind: "summary";
      winnable: number;
      threats: number;
      biggest: {
        keywordId: string;
        text: string;
        competitor: string | null;
        theirs: number | null;
        yours: number | null;
      } | null;
    };

export interface GapHeadlineScope {
  competitors: readonly KeywordComparisonCompetitor[];
  country: string;
  home: string;
}

export function gapHeadline(
  gaps: CompetitorGaps,
  { competitors, country, home }: GapHeadlineScope,
): GapHeadline {
  const empty = gapEmpty(gaps.coverage, country);
  if (empty !== "none") return { kind: empty };
  const winnable = gapRows(gaps, "winnable", country, home);
  const threats = gapRows(gaps, "threats", country, home).length;
  if (winnable.length === 0 && threats === 0) return { kind: "quiet" };
  const [first] = winnable;
  return {
    kind: "summary",
    winnable: winnable.length,
    threats,
    biggest:
      first === undefined
        ? null
        : {
            keywordId: first.keywordId,
            text: first.text,
            competitor:
              competitors.find(({ id }) => id === first.bestCompetitorId)
                ?.name ?? null,
            theirs: first.bestCompetitorPosition,
            yours: first.yourPosition,
          },
  };
}

const EMPTY_TEXT: Record<Exclude<GapEmpty, "none">, string> = {
  noCompetitors: "Add a competitor to see gaps.",
  allDelisted: "Every competitor you track is delisted.",
  notCompared: "Your competitors have not been checked yet.",
};

function biggestText(
  biggest: NonNullable<Extract<GapHeadline, { kind: "summary" }>["biggest"]>,
): string {
  const who = biggest.competitor ?? "a competitor";
  const theirs = biggest.theirs === null ? "" : ` ranks #${biggest.theirs}`;
  const yours =
    biggest.yours === null
      ? "you are not ranked"
      : `you are at #${biggest.yours}`;
  return `Biggest: ${biggest.text}, ${who}${theirs}, ${yours}.`;
}

export function headlineText(headline: GapHeadline): string {
  if (headline.kind === "quiet")
    return "No winnable gaps or threats right now.";
  if (headline.kind !== "summary") return EMPTY_TEXT[headline.kind];
  const winnable =
    headline.winnable === 0
      ? "No winnable gaps."
      : `${pluralize(headline.winnable, "winnable gap")}.`;
  const biggest =
    headline.biggest === null ? [] : [biggestText(headline.biggest)];
  const threats =
    headline.threats === 0 ? [] : [`${pluralize(headline.threats, "threat")}.`];
  return [winnable, ...biggest, ...threats].join(" ");
}

export interface HeadlineLink {
  label: string;
  href: string;
}

export function headlineLink(
  appId: string,
  headline: GapHeadline,
  country: string,
): HeadlineLink | null {
  const page = `/apps/${appId}/competitors`;
  if (headline.kind === "noCompetitors") {
    return { label: "Add a competitor", href: `${page}#competitor-search` };
  }
  if (headline.kind !== "summary") return null;
  const query = new URLSearchParams({
    gaps: headline.biggest === null ? "threats" : "winnable",
  });
  if (country !== "") query.set("gapCountry", country);
  if (headline.biggest !== null)
    query.set("keyword", headline.biggest.keywordId);
  return {
    label:
      headline.biggest === null ? "See the threats" : "See the winnable gaps",
    href: `${page}?${query.toString()}`,
  };
}
