import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  MARKET_SEED_LIMIT,
  MARKET_SEED_STATUSES,
  type AppStoreLocalization,
  type KeywordImportCost,
  type LocalizationReadRole,
  type MarketDailyRequests,
  type MarketSeedResult,
  type MarketSeedStatus,
  type MarketSuggestion,
  type MarketSuggestionsResult,
} from '../index';

describe('the market vocabulary', () => {
  it('lists the seed statuses once, seeded first', () => {
    expect(MARKET_SEED_STATUSES).toEqual(['seeded', 'unavailable']);
  });

  it('seeds at most fifteen keywords per market', () => {
    expect(MARKET_SEED_LIMIT).toBe(15);
  });
});

describe('the market contract', () => {
  it('types a suggestion with the storefront it names and its cost', () => {
    expectTypeOf<
      MarketSuggestion['localization']
    >().toEqualTypeOf<AppStoreLocalization>();
    expectTypeOf<
      MarketSuggestion['role']
    >().toEqualTypeOf<LocalizationReadRole>();
    expectTypeOf<
      MarketSuggestion['dailyRequests']
    >().toEqualTypeOf<MarketDailyRequests>();
    expectTypeOf<MarketSuggestionsResult['suggestions']>().toEqualTypeOf<
      MarketSuggestion[]
    >();
  });

  it('types a seed result with its status and the import cost shape', () => {
    expectTypeOf<
      MarketSeedResult['status']
    >().toEqualTypeOf<MarketSeedStatus>();
    expectTypeOf<MarketSeedResult['cost']>().toEqualTypeOf<KeywordImportCost>();
  });
});
