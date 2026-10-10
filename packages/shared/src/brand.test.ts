import { describe, expect, it } from 'vitest';
import { EMAIL_MARK_PATH, PRODUCT_NAME } from './brand';

describe('brand', () => {
  it('names the product AsoBeast', () => {
    expect(PRODUCT_NAME).toBe('AsoBeast');
  });

  it('serves the email mark from the public brand folder', () => {
    expect(EMAIL_MARK_PATH).toBe('/brand/email-mark.png');
  });
});
