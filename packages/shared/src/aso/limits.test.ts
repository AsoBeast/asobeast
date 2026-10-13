import { describe, expect, it } from 'vitest';

import { KEYWORD_FIELD_CHAR_LIMIT } from './limits';

describe('KEYWORD_FIELD_CHAR_LIMIT', () => {
  it('is the 100 characters App Store Connect accepts', () => {
    expect(KEYWORD_FIELD_CHAR_LIMIT).toBe(100);
  });
});
