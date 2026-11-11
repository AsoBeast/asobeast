export interface MarketChoice {
  country: string;
  count: number;
}

export function marketChoices(
  markets: readonly { country: string; keywordCount: number }[],
  selected: string,
): MarketChoice[] {
  const choices = markets.map((entry) => ({
    country: entry.country,
    count: entry.keywordCount,
  }));
  return choices.some((choice) => choice.country === selected)
    ? choices
    : [...choices, { country: selected, count: 0 }];
}
