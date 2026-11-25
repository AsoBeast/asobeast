export const OVERVIEW_SECTION = {
  ratingsByMarket: "overview.ratingsByMarket",
  storePreview: "overview.storePreview",
} as const;

export const OVERVIEW_SECTIONS: readonly string[] =
  Object.values(OVERVIEW_SECTION);
