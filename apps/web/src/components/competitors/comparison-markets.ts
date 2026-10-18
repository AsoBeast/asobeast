import type { KeywordComparisonRow } from "@asobeast/shared";
import { formatCountry } from "@/lib/format";

export const ALL_MARKETS = "all";

const byName = (a: string, b: string) =>
  formatCountry(a).localeCompare(formatCountry(b), "en");

export function comparisonMarkets(
  rows: readonly Pick<KeywordComparisonRow, "country">[],
  home: string,
): string[] {
  const markets = [...new Set(rows.map((row) => row.country))];
  return [
    ...markets.filter((market) => market === home),
    ...markets.filter((market) => market !== home).sort(byName),
  ];
}

export const marketOptions = (markets: readonly string[]) => [
  { value: ALL_MARKETS, label: "All markets" },
  ...markets.map((market) => ({ value: market, label: formatCountry(market) })),
];
