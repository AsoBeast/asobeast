import type { CompetitorGapCoverage } from "@asobeast/shared";

export function coverageLine(
  coverage: CompetitorGapCoverage | undefined,
  country: string,
): string | null {
  if (coverage === undefined) return null;
  const markets =
    country === ""
      ? coverage.markets
      : coverage.markets.filter((market) => market.country === country);
  if (markets.length === 0) return null;
  const keywords = markets.reduce((sum, market) => sum + market.keywords, 0);
  const compared = markets.reduce((sum, market) => sum + market.compared, 0);
  const noun = keywords === 1 ? "keyword" : "keywords";
  const scope = markets.length === 1 ? "" : ` in ${markets.length} markets`;
  return `Compared on ${compared} of ${keywords} ${noun}${scope}`;
}
