import { describe, expect, expectTypeOf, it } from 'vitest';
import { CHANGE_IMPACT_WINDOWS } from './change-impact';
import {
  STORE_FUNNEL_COMPLETE_AFTER_DAYS,
  STORE_FUNNEL_DEFAULT_DAYS,
  STORE_FUNNEL_MAX_DAYS,
  STORE_FUNNEL_PAGE_TYPES,
  STORE_FUNNEL_SOURCE_KINDS,
  STORE_FUNNEL_SOURCES,
  STORE_FUNNEL_WINDOWS,
  funnelChange,
  funnelConversion,
  type StoreFunnelCounts,
  type StoreFunnelPage,
  type StoreFunnelReport,
} from './store-funnel';

describe('store funnel contract', () => {
  it('shares the change impact windows', () => {
    expect(STORE_FUNNEL_WINDOWS).toBe(CHANGE_IMPACT_WINDOWS);
  });

  it('rounds a conversion to four decimals', () => {
    expect(funnelConversion(37, 1_234)).toBe(0.03);
    expect(funnelConversion(1, 3)).toBe(0.3333);
    expect(funnelConversion(5, 0)).toBeNull();
    expect(funnelConversion(5, null)).toBeNull();
  });

  it('rounds a relative change to three decimals', () => {
    expect(funnelChange(118, 100)).toBe(0.18);
    expect(funnelChange(80, 100)).toBe(-0.2);
    expect(funnelChange(10, 0)).toBeNull();
    expect(funnelChange(null, 10)).toBeNull();
    expect(funnelChange(10, null)).toBeNull();
    expect(funnelChange(0, 0)).toBeNull();
  });

  it('keeps impressions nullable for a store without them', () => {
    expectTypeOf<StoreFunnelCounts['impressions']>().toEqualTypeOf<
      number | null
    >();
    expectTypeOf<StoreFunnelCounts['uniqueImpressions']>().toEqualTypeOf<
      number | null
    >();
  });

  it('exports every source, page type and constant', () => {
    expect(STORE_FUNNEL_SOURCES).toContain('search');
    expect(STORE_FUNNEL_SOURCES).toContain('all');
    expect(STORE_FUNNEL_PAGE_TYPES).toContain('productPage');
    expect(STORE_FUNNEL_SOURCE_KINDS).toEqual([
      'appStoreConnect',
      'playConsole',
    ]);
    expect(STORE_FUNNEL_COMPLETE_AFTER_DAYS).toBe(3);
    expect(STORE_FUNNEL_DEFAULT_DAYS).toBe(90);
    expect(STORE_FUNNEL_MAX_DAYS).toBe(365);
  });
});

describe('product pages', () => {
  it('types a product page with its ratio to the default page', () => {
    expectTypeOf<StoreFunnelPage['ratio']>().toEqualTypeOf<number | null>();
    expectTypeOf<
      StoreFunnelPage['counts']
    >().toEqualTypeOf<StoreFunnelCounts>();
  });

  it('keeps pages optional on the report', () => {
    expectTypeOf<StoreFunnelReport['pages']>().toEqualTypeOf<
      StoreFunnelPage[] | undefined
    >();
  });
});
