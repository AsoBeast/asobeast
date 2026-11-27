import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  COVERAGE_PREVIEW_CHANGES,
  DRAFT_WASTE_REASONS,
  isCoveragePreviewChange,
} from '../index';
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

describe('coverage preview contract', () => {
  it('lists the preview changes in reading order', () => {
    expect(COVERAGE_PREVIEW_CHANGES).toEqual([
      'lost',
      'gained',
      'missing',
      'kept',
    ]);
  });

  it('names the draft waste reasons', () => {
    expect(DRAFT_WASTE_REASONS).toEqual(['repeated', 'unused']);
  });

  it('tells a preview change from any other string', () => {
    expect(isCoveragePreviewChange('gained')).toBe(true);
    expect(isCoveragePreviewChange('won')).toBe(false);
    expect(isCoveragePreviewChange(undefined)).toBe(false);
  });
});
