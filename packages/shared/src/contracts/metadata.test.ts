import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  AppStoreLocalization,
  MetadataAssistantRequest,
  MetadataAssistantResult,
} from '../index';

describe('metadata assistant contract', () => {
  it('lets a request name the localization to draft', () => {
    const request: MetadataAssistantRequest = { localization: 'es-MX' };

    expect(request.localization).toBe('es-MX');
    expectTypeOf<MetadataAssistantRequest['localization']>().toEqualTypeOf<
      AppStoreLocalization | undefined
    >();
  });

  it('echoes the drafted localization, or null for the primary listing', () => {
    const result: MetadataAssistantResult = {
      model: 'gpt-test',
      drafts: [],
      localization: null,
    };

    expect(result.localization).toBeNull();
    expectTypeOf<MetadataAssistantResult['localization']>().toEqualTypeOf<
      AppStoreLocalization | null | undefined
    >();
  });
});
